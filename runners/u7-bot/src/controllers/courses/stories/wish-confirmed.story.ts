import type { DomainEvent } from '@u7-scl/core/domain';
import { md, mdJoin } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  UiEventSubscription,
} from '@u7-scl/core/ui';
import { eventSubscription } from '@u7-scl/core/ui';
import {
  CourseModuleDef,
  GetCourseByModuleUcDef,
  GetCourseUcDef,
} from '@u7-scl/domain/course/contract';
import {
  ListStreamsUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { UserView } from '@u7-scl/domain/user/contract';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import type * as v from 'valibot';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { U7BotUiStory } from '../../../core/u7-bot-ui-story';

/**
 * Подтверждение желания в legacy-форме, как его доставляет
 * `legacyEventBus`: `eventName` — FQN Def, `payload` — по схеме
 * `WishEvents.confirmed`.
 */
export type WishConfirmedEvent = DomainEvent & {
  eventName: typeof WishEvents.confirmed.name;
  payload: v.InferOutput<typeof WishEvents.confirmed.payload>;
};

/** Профиль ментора. */
type Mentor = UserView;

/**
 * Уведомление менторам о подтверждённом желании (проактивное).
 *
 * Подписка на `WishEvents.confirmed` (FQN `wish.wish.confirmed`;
 * публикует ER confirm-wish после
 * анкетной ветки). Собирает имя пользователя, название курса и всех
 * менторов, которые когда-либо вели потоки этого курса, и рассылает
 * им notify-проактив (без кнопок). Автор желания и менторы без
 * telegramId — пропуск; недоступные профиль/курс — молчаливый
 * пропуск (уведомление невозможно).
 */
export class WishConfirmedStory extends U7BotUiStory {
  readonly name = 'wish-confirmed';

  // ── Подписки на доменные события ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription<WishConfirmedEvent>(
        WishEvents.confirmed.name,
        (event) => this.#handleConfirmed(event),
      ),
    ];
  }

  async #handleConfirmed(event: WishConfirmedEvent): Promise<void> {
    const { userId, courseId } = event.payload;

    const user = await this.#fetchUser(userId);
    const course = await this.#fetchCourse(courseId);
    if (!user) return;

    const mentors = await this.#courseMentors(courseId);
    const text = mdJoin([
      md`📗 *${user.name}* подтвердил желание проходить курс *${course?.title ?? courseId}*\\.`,
    ]);

    for (const mentor of mentors) {
      // Автор не уведомляет сам себя; без telegramId доставить некому
      if (mentor.uuid === userId || mentor.telegramId === undefined) continue;
      await this.proactiveSender.notify(mentor.telegramId, { text });
    }
  }

  /**
   * Все менторы, когда-либо ведшие потоки курса: список потоков,
   * принадлежность moduleId → courseId (с кэшем запросов), дедупликация.
   */
  async #courseMentors(courseId: string): Promise<Mentor[]> {
    let streams: Array<{ mentorId: string; moduleId: string }>;
    try {
      const listed = await this.dispatchUcAsGuest(
        StreamModuleDef,
        ListStreamsUcDef.command({}),
      );
      if (!listed.ok) return [];
      streams = listed.value;
    } catch {
      return [];
    }

    const mentorIds = new Set<string>();
    const courseOfModule = new Map<string, string | undefined>();
    for (const s of streams) {
      if (!courseOfModule.has(s.moduleId)) {
        courseOfModule.set(
          s.moduleId,
          (await this.#fetchCourseByModule(s.moduleId))?.uuid,
        );
      }
      if (courseOfModule.get(s.moduleId) === courseId) {
        mentorIds.add(s.mentorId);
      }
    }

    const mentors: Mentor[] = [];
    for (const uuid of mentorIds) {
      const mentor = await this.#fetchUser(uuid);
      if (mentor) mentors.push(mentor);
    }
    return mentors;
  }

  /** Профиль пользователя; сбой чтения — undefined (уведомление невозможно). */
  async #fetchUser(uuid: string): Promise<Mentor | undefined> {
    try {
      return await this.findUser(uuid);
    } catch {
      return undefined;
    }
  }

  /** Курс для карточки уведомления; отказ — undefined. */
  async #fetchCourse(courseId: string) {
    const res = await this.dispatchUcAsGuest(
      CourseModuleDef,
      GetCourseUcDef.command({ courseId }),
    );
    return res.ok ? res.value : undefined;
  }

  /** Курс модуля; отказ или модуль вне курсов — undefined. */
  async #fetchCourseByModule(moduleId: string) {
    const res = await this.dispatchUcAsGuest(
      CourseModuleDef,
      GetCourseByModuleUcDef.command({ moduleId }),
    );
    return res.ok ? res.value : undefined;
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
