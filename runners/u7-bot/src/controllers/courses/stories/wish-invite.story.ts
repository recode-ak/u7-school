import { type MdText, md, mdConcat, mdJoin, mdRaw } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  UiEventSubscription,
} from '@u7-scl/core/ui';
import { eventSubscription } from '@u7-scl/core/ui';
import {
  CourseModuleDef,
  GetCourseUcDef,
  GetModuleUcDef,
} from '@u7-scl/domain/course/contract';
import {
  GetStreamUcDef,
  StreamModuleDef,
  type StreamView,
} from '@u7-scl/domain/stream/contract';
import type { UserView } from '@u7-scl/domain/user/contract';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import type { EnvelopeOf } from 'dmg-core/app';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { U7BotUiStory } from '../../../core/u7-bot-ui-story';
import { Routes } from '../../shared/routes';

/**
 * Приглашение желающему — конверт DMG, `payload` — по схеме `WishEvents.invited`.
 */
export type WishInvitedEvent = EnvelopeOf<typeof WishEvents.invited>;

/** Профиль ментора в карточке приглашения. */
type Mentor = UserView;

/**
 * S11 — приглашение желающему при открытии набора (проактивное, кнопочное).
 *
 * Подписка на `WishEvents.invited` (FQN `wish.wish.invited`; публикует
 * ER invite-wishers модуля wish).
 * Собирает поток / курс (модуль) / ментора через appApi и доставляет
 * кнопочный проактив канала invite — с кнопкой «🗑️ Отменить желание»,
 * ведущей в существующие экраны отмены W05 / W05-M (course-catalog).
 *
 * Кнопочный проактив (ФР-6) — до переезда в tasks-system (см. TODO.md):
 * сторя уходит после ввода модуля задач.
 */
export class WishInviteStory extends U7BotUiStory {
  readonly name = 'wish-invite';

  // ── Подписки на доменные события ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription(WishEvents.invited, (event) =>
        this.#handleInvited(event),
      ),
    ];
  }

  async #handleInvited(event: WishInvitedEvent): Promise<void> {
    const { payload } = event;
    const { telegramId, streamId, targetKind } = payload;
    const courseId =
      payload.targetKind === 'course' ? payload.courseId : undefined;
    const moduleId =
      payload.targetKind === 'module' ? payload.moduleId : undefined;

    let stream: StreamView;
    try {
      const loaded = await this.dispatchUcAsGuest(
        StreamModuleDef,
        GetStreamUcDef.command({ streamId }),
      );
      // Поток недоступен — приглашение невозможно (молчаливый пропуск)
      if (!loaded.ok) return;
      stream = loaded.value;
    } catch {
      // Поток недоступен — приглашение невозможно (молчаливый пропуск)
      return;
    }

    // Заголовок желания и код отмены — по виду цели (ассоциация с кнопкой)
    const subject = await this.#wishSubject(targetKind, courseId, moduleId);
    if (!subject) return;
    const cancelCode =
      targetKind === 'course' && courseId
        ? Routes.course.cancelWishCourse(courseId)
        : moduleId
          ? Routes.course.cancelWishModule(moduleId)
          : undefined;
    if (!cancelCode) return;

    const mentorLine = await this.#mentorLine(stream.mentorId);

    // Ключ набора опционален: без него запись мгновенная, без кодового слова
    const enrollHint = stream.requiresEnrollmentKey
      ? md`Для записи нужен ключ — его выдаёт ментор\\. Запись: /start → 🏫 Школа → 📚 Потоки → «${stream.title}» → 📝 Записаться\\.`
      : md`Запись свободная: /start → 🏫 Школа → 📚 Потоки → «${stream.title}» → 📝 Записаться\\.`;

    const startIso = new Date(stream.startDate).toISOString();
    const text = mdJoin([
      md`📣 *Открылся набор\\!*`,
      md``,
      subject,
      md``,
      md`📚 Поток: «${stream.title}»`,
      md`📅 Старт: ${this.formatDate(startIso)}, ${this.#formatTime(startIso)}`,
      ...mentorLine,
      md``,
      enrollHint,
    ]);

    await this.proactiveSender.invite(telegramId, {
      text,
      keyboard: this.kb([
        [
          this.btn('📝 Записаться', Routes.stream.enroll(streamId)),
          this.btn('🗑️ Отменить желание', cancelCode),
        ],
      ]),
    });
  }

  /** Строка «У тебя было желание пройти …» — заголовок карточки. */
  async #wishSubject(
    targetKind: 'course' | 'module',
    courseId: string | undefined,
    moduleId: string | undefined,
  ): Promise<MdText | undefined> {
    if (targetKind === 'course' && courseId) {
      const course = await this.#fetchCourse(courseId);
      const title = course?.title ?? courseId;
      return md`У тебя было желание пройти курс *${title}* — на него открыт набор\\.`;
    }
    if (moduleId) {
      const mod = await this.#fetchModule(moduleId);
      const title = mod?.title ?? moduleId;
      return md`У тебя было желание пройти модуль *${title}* — на него открыт набор\\.`;
    }
    // payload без опознаваемой цели — приглашение невозможно
    return undefined;
  }

  /**
   * Строка «👤 Ментор: …» (пустой массив — профиль недоступен, строка
   * опускается). Есть nick → рабочая ссылка t.me/{nick}; ника нет →
   * ЭКСПЕРИМЕНТ: tg://user?id (MarkdownV2 официально не поддерживает —
   * после живого теста либо оставить, либо заменить на простое имя).
   */
  async #mentorLine(mentorId: string): Promise<MdText[]> {
    const mentor = await this.#fetchMentor(mentorId);
    if (!mentor) return [];

    const label = md`${mentor.name}`;
    if (mentor.nick) {
      return [
        mdConcat(
          mdRaw('👤 Ментор: ['),
          label,
          mdRaw(`](https://t.me/${mentor.nick})`),
        ),
      ];
    }
    if (mentor.telegramId !== undefined) {
      return [
        mdConcat(
          mdRaw('👤 Ментор: ['),
          label,
          mdRaw(`](tg://user?id=${mentor.telegramId})`),
        ),
      ];
    }
    return [mdConcat(mdRaw('👤 Ментор: '), label)];
  }

  /** Курс для заголовка карточки; отказ — undefined. */
  async #fetchCourse(courseId: string) {
    const res = await this.dispatchUcAsGuest(
      CourseModuleDef,
      GetCourseUcDef.command({ courseId }),
    );
    return res.ok ? res.value : undefined;
  }

  /** Модуль для заголовка карточки; отказ — undefined. */
  async #fetchModule(moduleId: string) {
    const res = await this.dispatchUcAsGuest(
      CourseModuleDef,
      GetModuleUcDef.command({ moduleId }),
    );
    return res.ok ? res.value : undefined;
  }

  async #fetchMentor(uuid: string): Promise<Mentor | undefined> {
    try {
      return await this.findUser(uuid);
    } catch {
      return undefined;
    }
  }

  /** Форматирует ISO-дату в чч:мм (UTC, как в карточке потока S02). */
  #formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${min}`;
    } catch {
      return iso;
    }
  }

  // ── Story не интерактивна: callback не обрабатывает ──

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    return this.unknownCommand(action, actor, session);
  }
}
