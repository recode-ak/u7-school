import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MenuButton } from '@u7-scl/bot/u7-menu';
import { md, mdRaw, safeConvert } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  KbButton,
  UiEventSubscription,
} from '@u7-scl/core/ui';
import { eventSubscription } from '@u7-scl/core/ui';
import {
  CourseModuleDef,
  GetModulePlaceUcDef,
} from '@u7-scl/domain/course/contract';
import {
  DropStudentUcDef,
  GetActiveStudentUcDef,
  StreamModuleDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import type { EnvelopeOf } from 'dmg-core/app';
import { buttons } from '../../shared/buttons';
import { getStudent, type StreamDispatch } from '../shared';

/**
 * Завершение модуля студентом — конверт DMG, `payload` — по схеме
 * `StudentEvents.completed`.
 */
export type StudentCompletedEvent = EnvelopeOf<typeof StudentEvents.completed>;

/**
 * Хаб «Моя учёба» — главное меню обучения: самовыход (FR-4) через UC
 * dropStudent даёт abandoned и мягкий кик из TG-группы (FR-6, событие
 * слушает InactivityStory). О зачислении студент узнаёт из view-stream.
 */
export class HubStory extends U7BotUiStory {
  readonly name = 'hub';

  // ── Подписки на доменные события ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription(StudentEvents.completed, (event) =>
        this.#handleCompletedEvent(event),
      ),
    ];
  }

  /**
   * StudentEvents.completed — кнопочные ветки 7a/7b через канал invite
   * (ФР-6, исключение И3 до tasks-system): кнопка ведёт в
   * CourseCatalogStory (wish → UC create-module-wish). Безкнопочные
   * 7c/7d («Курс завершён», место неизвестно) — notify этой же стори.
   */
  async #handleCompletedEvent(event: StudentCompletedEvent): Promise<void> {
    const { userId, moduleId, outcome } = event.payload;

    const user = await this.findUser(userId);
    if (!user?.telegramId) return;

    // Место модуля в программе — идёт через домен курсов
    const placeRes = await this.dispatchUcAsGuest(
      CourseModuleDef,
      GetModulePlaceUcDef.command({ moduleId }),
    );
    const place = placeRes.ok ? placeRes.value : undefined;

    if (outcome === 'not_advanced') {
      // Повтор того же модуля (7b) — кнопочный проактив, канал invite
      await this.proactiveSender.invite(user.telegramId, {
        text: md`🔁 Модуль не пройден до конца\\.\n\nХочешь записаться на него снова\\?`,
        keyboard: this.kb([
          [buttons.wishModule(moduleId, '🔁 Пройти модуль снова')],
        ]),
      });
      return;
    }

    if (place?.nextModuleId) {
      // advanced + есть следующий модуль (7a) — кнопочный проактив, invite
      await this.proactiveSender.invite(user.telegramId, {
        text: md`🏁 Модуль завершён\\!\n\nХочешь записаться на следующий\\?`,
        keyboard: this.kb([[buttons.wishModule(place.nextModuleId)]]),
      });
      return;
    }
    // advanced и нет следующего модуля (7c/7d): «Курс завершён» для
    // последнего модуля программы, иначе «Модуль завершён»
    const text = place?.isLast
      ? '🎉 Курс завершён! Поздравляем — ты прошёл всю программу.'
      : '🏁 Модуль завершён!';
    await this.proactiveSender.notify(user.telegramId, {
      text: mdRaw(safeConvert(text)),
      kind: 'info',
    });
  }

  // ── Callback ──

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (action === 'my-study') {
      return this.#showHub(actor);
    }
    if (action === 'my-study:leave-confirm') {
      return this.#showLeaveConfirm(actor);
    }
    if (action === 'my-study:leave') {
      return this.#executeLeave(actor);
    }
    return this.unknownCommand(action, actor, session);
  }

  // ── Главное меню (декларативные кнопки) ──

  override async menuButtons(actor: U7BotActor): Promise<MenuButton[]> {
    // Меню — только при живой записи студента (учится или зачислен)
    let hasActiveStudent = false;
    try {
      const active = await this.dispatchUc(
        StreamModuleDef,
        GetActiveStudentUcDef.command({ userId: actor.user.uuid }),
        actor,
      );
      hasActiveStudent = active.ok && active.value.student !== undefined;
    } catch {
      // отказ модуля потоков не ломает главное меню: кнопки учёбы нет
    }
    if (hasActiveStudent) {
      return [
        {
          kind: 'callback',
          text: '🎓 Моя учёба',
          action: this.cb('my-study'),
          priority: 20,
          description: '🎓 Моя учёба — доступ к твоим учебным материалам',
        },
      ];
    }
    return [];
  }

  /** Команды модуля `stream` от имени актора — для хелперов раздела learning. */
  #dispatchFor(actor: U7BotActor): StreamDispatch {
    return (command) => this.dispatchUc(StreamModuleDef, command, actor);
  }

  // ── Приватные методы: хаб ──

  /** Экран хаба «Моя учёба» с кнопками действий. */
  async #showHub(actor: U7BotActor): Promise<DialogResponse> {
    const studentResult = await getStudent(this.#dispatchFor(actor), actor);
    if (!studentResult.ok) return studentResult.value;

    const student = studentResult.value;
    const isFinished = student.outcome.category !== 'in_progress';

    const rows: KbButton[][] = [];

    if (!isFinished) {
      const hasStarted = student.steps.some((s) => s.status === 'completed');
      rows.push([
        this.btn(
          hasStarted ? '▶️ Продолжить учёбу' : '▶️ Начать учёбу',
          this.cbFor('step-view', 'my-study:continue'),
        ),
      ]);
      rows.push([
        this.btn(
          '📖 Программа модуля',
          this.cbFor('nav-tree', 'my-study:lessons'),
        ),
      ]);
    }

    rows.push([
      this.btn(
        '📊 Мой прогресс',
        this.cbFor('progress', 'progress', student.streamId),
      ),
    ]);
    rows.push([
      this.btn('🚪 Покинуть учёбу', this.cb('my-study:leave-confirm')),
    ]);
    rows.push([buttons.mainMenu()]);

    return this.screen(md`📖 *Моя учёба*\n\nВыберите действие:`, this.kb(rows));
  }

  // ── Приватные методы: самовыход из учёбы (FR-4) ──

  async #showLeaveConfirm(actor: U7BotActor): Promise<DialogResponse> {
    const studentResult = await getStudent(this.#dispatchFor(actor), actor);
    if (!studentResult.ok) return studentResult.value;

    return this.screen(
      md`🚪 *Покинуть учёбу?*\n\nПрогресс сохранится, но ментор больше не будет тебя сопровождать\\.`,
      this.kb([
        [
          this.btn('🚪 Да, покинуть', this.cb('my-study:leave')),
          this.btn('❌ Остаться', this.cb('my-study')),
        ],
      ]),
    );
  }

  async #executeLeave(actor: U7BotActor): Promise<DialogResponse> {
    const studentResult = await getStudent(this.#dispatchFor(actor), actor);
    if (!studentResult.ok) return studentResult.value;

    const student = studentResult.value;

    const dropped = await this.dispatchUc(
      StreamModuleDef,
      DropStudentUcDef.command({
        streamId: student.streamId,
        studentId: student.uuid,
      }),
      actor,
    );
    if (!dropped.ok) return this.ucErrorNotify(dropped.error);

    return this.screen(
      md`Ты покинул учёбу\\. Жаль, что не сложилось — возвращайся, когда будешь готов\\!`,
      this.kb([[buttons.mainMenu('⬅️ В меню')]]),
    );
  }
}
