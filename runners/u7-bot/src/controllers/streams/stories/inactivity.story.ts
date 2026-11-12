import {
  type MdText,
  md,
  mdJoin,
  mdRaw,
  safeConvert,
} from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  UiEventSubscription,
} from '@u7-scl/core/ui';
import { eventSubscription } from '@u7-scl/core/ui';
import {
  DropStudentUcDef,
  GetStreamUcDef,
  GetStudentProgressUcDef,
  MarkAbandonedUcDef,
  StreamModuleDef,
  type StreamView,
  StudentEvents,
  type StudentView,
} from '@u7-scl/domain/stream/contract';
import type { EnvelopeOf } from 'dmg-core/app';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { U7BotUiStory } from '../../../core/u7-bot-ui-story';
import { Routes } from '../../shared/routes';

/**
 * События студента — конверты DMG, `payload` — по схеме события.
 */
export type StudentInactivityWarningEvent = EnvelopeOf<
  typeof StudentEvents.inactivityWarning
>;
export type StudentInactivityRemoveCandidateEvent = EnvelopeOf<
  typeof StudentEvents.inactivityRemoveCandidate
>;
export type StudentAbandonedEvent = EnvelopeOf<typeof StudentEvents.abandoned>;

/** Профиль пользователя в части, нужной уведомлениям. */
type Profile = { name: string; telegramId?: number };

/**
 * Проактивные уведомления о бездействии и уходе из учёбы: события Job
 * `inactivitySweep` и агрегата Student (FQN Def). Адрес получателя событие
 * не несёт: telegramId — по профилю через legacy `get-user`, ментор —
 * `getStream(streamId).mentorId`; нажатия обрабатывает handleCallback.
 */
export class InactivityStory extends U7BotUiStory {
  readonly name = 'inactivity';

  // ── Подписки на доменные события ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription(StudentEvents.inactivityWarning, (event) =>
        this.#handleWarningEvent(event),
      ),
      eventSubscription(StudentEvents.inactivityRemoveCandidate, (event) =>
        this.#handleCandidateEvent(event),
      ),
      eventSubscription(StudentEvents.abandoned, (event) =>
        this.#handleAbandonedEvent(event),
      ),
    ];
  }

  /** Предупреждение студенту о бездействии (ступень 5+ дней, FR-1). */
  async #handleWarningEvent(
    event: StudentInactivityWarningEvent,
  ): Promise<void> {
    const { studentId, userId, days } = event.payload;

    const telegramId = await this.#resolveTelegramId(userId);
    if (telegramId === undefined) {
      this.logger?.warn(
        this.name,
        'Предупреждение о бездействии не отправлено: нет telegramId студента',
        { userId },
      );
      return;
    }

    await this.proactiveSender.invite(telegramId, {
      text: mdJoin([
        md`⏳ *Учёба стоит*`,
        md``,
        md`Ты не занимаешься уже ${this.#pluralizeDays(days)}\\.`,
        md``,
        md`Если бездействие продлится больше недели, ментор может снять тебя с учёбы за бездействие\\.`,
      ]),
      keyboard: this.kb([
        [
          this.btn(
            '🚪 Покинуть учёбу',
            Routes.stream.inactivityDrop(studentId),
          ),
        ],
      ]),
    });
  }

  /** Уведомление ментору о кандидате на снятие с учёбы (ступень 7+ дней). */
  async #handleCandidateEvent(
    event: StudentInactivityRemoveCandidateEvent,
  ): Promise<void> {
    const { studentId, userId, streamId, days, wasWarned } = event.payload;

    const stream = await this.#resolveStream(streamId);
    if (!stream) {
      this.logger?.warn(
        this.name,
        'Уведомление ментору не отправлено: поток недоступен',
        { streamId },
      );
      return;
    }
    const [studentName, mentorTelegramId] = await Promise.all([
      this.#resolveName(userId),
      this.#resolveTelegramId(stream.mentorId),
    ]);
    if (mentorTelegramId === undefined) {
      this.logger?.warn(
        this.name,
        'Уведомление ментору не отправлено: нет telegramId ментора',
        { mentorId: stream.mentorId },
      );
      return;
    }
    const streamTitle = stream.title;

    const lines: MdText[] = [
      md`🛑 *Кандидат на снятие с учёбы*`,
      md``,
      md`Студент *${studentName}* из группы «${streamTitle}» не занимался ${this.#pluralizeDays(days)}\\.`,
    ];
    if (wasWarned) {
      lines.push(md``, md`ℹ️ Уведомления были ранее отправлены студенту\\.`);
    }

    await this.proactiveSender.invite(mentorTelegramId, {
      text: mdJoin(lines),
      keyboard: this.kb([
        [
          this.btn(
            '⚠️ Снять с учёбы',
            Routes.stream.inactivityMarkAbandoned(studentId),
          ),
        ],
      ]),
    });
  }

  /**
   * Уход из учёбы: мягкий кик из Telegram-группы потока (FR-6) для любого
   * ухода; текст — самовыход ментору, снятие по бездействию студенту.
   * Поток недоступен — ничего не делаем (предупреждение в лог).
   */
  async #handleAbandonedEvent(event: StudentAbandonedEvent): Promise<void> {
    const { userId, streamId, who, cause } = event.payload;

    const [stream, student] = await Promise.all([
      this.#resolveStream(streamId),
      this.#resolveProfile(userId),
    ]);
    if (!stream) {
      this.logger?.warn(
        this.name,
        'Уход студента не обработан: поток недоступен',
        { streamId },
      );
      return;
    }

    // FR-6: мягкое исключение из Telegram-группы потока — для всех уходов
    if (stream.telegramGroupId !== undefined && student?.telegramId) {
      await this.proactiveSender.kickFromGroup(
        stream.telegramGroupId,
        student.telegramId,
      );
    }

    if (who === 'self') {
      const name = student?.name ?? userId.slice(0, 8);
      await this.#notify(
        stream.mentorId,
        `🚪 Студент ${name} покинул учёбу с потока «${stream.title}» по собственному желанию.`,
        'info',
      );
      return;
    }
    if (cause === 'inactivity') {
      await this.#notify(
        userId,
        `Ты снят с учёбы с потока «${stream.title}» за бездействие и исключён из его группы. Прогресс сохранён — если захочешь вернуться, напиши ментору потока.`,
        'warn',
      );
    }
  }

  /** Текст пользователю по uuid (адрес — профиль); нет адреса — пропуск с warn. */
  async #notify(
    userId: string,
    text: string,
    kind: 'info' | 'warn',
  ): Promise<void> {
    const telegramId = await this.#resolveTelegramId(userId);
    if (telegramId === undefined) {
      this.logger?.warn(
        this.name,
        'Уведомление не отправлено: нет telegramId получателя',
        { userId },
      );
      return;
    }
    await this.proactiveSender.notify(telegramId, {
      text: mdRaw(safeConvert(text)),
      kind,
    });
  }

  // ── Callback ──

  /**
   * Кнопки канала invite (FR-4 самовыход / FR-5 снятие ментором):
   * confirm-диалог → UC drop-student / mark-abandoned.
   */
  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, id] = action.split(':');

    // Самовыход: confirm → drop-student (FR-4)
    if (cmd === 'drop-student' && id) {
      return this.confirm(
        'drop-student',
        id,
        md`Покинуть учёбу?\n\nПрогресс сохранится, но ментор больше не будет тебя сопровождать\\.`,
        {
          confirmButton: '🚪 Да, покинуть',
          cancelButton: '❌ Остаться',
          cancelCode: Routes.app.mainMenu,
        },
      );
    }
    if (cmd === 'drop-student-confirm' && id) {
      return this.#executeDrop(id, actor);
    }

    // Снятие с учёбы ментором: confirm → mark-abandoned (FR-5)
    if (cmd === 'mark-abandoned' && id) {
      const student = await this.#getStudent(id, actor);
      if (!student) {
        return this.screen(md`⚠️ Запись студента не найдена`);
      }
      const name = await this.#resolveName(student.userId);
      return this.confirm(
        'mark-abandoned',
        id,
        md`Снять студента *${name}* с учёбы за бездействие?\n\nСтудент будет исключён из группы потока и получит уведомление\\.`,
        {
          confirmButton: '⚠️ Да, снять с учёбы',
          cancelButton: '❌ Отмена',
          cancelCode: Routes.app.mainMenu,
        },
      );
    }
    if (cmd === 'mark-abandoned-confirm' && id) {
      return this.#executeMarkAbandoned(id, actor);
    }

    return this.unknownCommand(action, actor, session);
  }

  // ── Приватные методы ──

  /** Самовыход студента (FR-4): UC drop-student + прощание. */
  async #executeDrop(
    studentId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const student = await this.#getStudent(studentId, actor);
    if (!student) {
      return this.screen(md`⚠️ Запись студента не найдена`);
    }

    const dropped = await this.dispatchUc(
      StreamModuleDef,
      DropStudentUcDef.command({ streamId: student.streamId, studentId }),
      actor,
    );
    if (!dropped.ok) return this.ucErrorNotify(dropped.error);

    return this.screen(
      md`Ты покинул учёбу\\. Жаль, что не сложилось — возвращайся, когда будешь готов\\!`,
      this.kb([[this.btn('⬅️ В меню', Routes.app.mainMenu)]]),
    );
  }

  /** Снятие ментором за бездействие (FR-5): UC mark-abandoned. */
  async #executeMarkAbandoned(
    studentId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const student = await this.#getStudent(studentId, actor);
    if (!student) {
      return this.screen(md`⚠️ Запись студента не найдена`);
    }

    const abandoned = await this.dispatchUc(
      StreamModuleDef,
      MarkAbandonedUcDef.command({
        streamId: student.streamId,
        studentId,
        cause: 'inactivity',
      }),
      actor,
    );
    if (!abandoned.ok) return this.ucErrorNotify(abandoned.error);

    const name = await this.#resolveName(student.userId);

    return this.screen(
      md`✅ Студент *${name}* снят с учёбы за бездействие и исключён из группы потока\\.`,
    );
  }

  /** Запись студента (streamId для команды UC); недоступна — undefined. */
  async #getStudent(
    studentId: string,
    actor: U7BotActor,
  ): Promise<StudentView | undefined> {
    try {
      const res = await this.dispatchUc(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId }),
        actor,
      );
      return res.ok ? res.value.student : undefined;
    } catch {
      return undefined;
    }
  }

  /** Профиль пользователя по uuid; недоступен — undefined. */
  async #resolveProfile(userId: string): Promise<Profile | undefined> {
    try {
      return await this.findUser(userId);
    } catch {
      return undefined;
    }
  }

  /** Имя пользователя по uuid (fallback — первые 8 символов id). */
  async #resolveName(userId: string): Promise<string> {
    return (await this.#resolveProfile(userId))?.name ?? userId.slice(0, 8);
  }

  /** telegramId пользователя по uuid. */
  async #resolveTelegramId(userId: string): Promise<number | undefined> {
    return (await this.#resolveProfile(userId))?.telegramId;
  }

  /** Поток по id (undefined, если недоступен). */
  async #resolveStream(streamId: string): Promise<StreamView | undefined> {
    try {
      const stream = await this.dispatchUcAsGuest(
        StreamModuleDef,
        GetStreamUcDef.command({ streamId }),
      );
      return stream.ok ? stream.value : undefined;
    } catch {
      return undefined;
    }
  }

  /** Склоняет «N дней» (1 день, 2 дня, 5 дней). */
  #pluralizeDays(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word =
      mod100 >= 11 && mod100 <= 19
        ? 'дней'
        : mod10 === 1
          ? 'день'
          : mod10 >= 2 && mod10 <= 4
            ? 'дня'
            : 'дней';
    return `${n} ${word}`;
  }
}
