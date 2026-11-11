import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { DomainEvent } from '@u7-scl/core/domain';
import { type MdText, md } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  UiEventSubscription,
} from '@u7-scl/core/ui';
import { eventSubscription } from '@u7-scl/core/ui';
import { ReviewEvents } from '@u7-scl/domain/peer-review/contract';
import type * as v from 'valibot';

/**
 * Событие в legacy-форме, как его доставляет `legacyEventBus`:
 * `eventName` — FQN Def, `payload` — по схеме `ReviewEvents.created`.
 */
export type ReviewCreatedEvent = DomainEvent & {
  eventName: typeof ReviewEvents.created.name;
  payload: v.InferOutput<typeof ReviewEvents.created.payload>;
};

/** Профиль участника (telegramId может отсутствовать). */
type Profile = { uuid: string; name: string; telegramId?: number };

/**
 * US: уведомление адресата о новом отзыве — по событию первой записи отзыва
 * (перезапись события не создаёт — спама нет).
 *
 * Подписка на `ReviewEvents.created` (FQN `peer-review.review.created`).
 * Имена автора и адресата — один batch-запрос `get-users-by-ids`; сообщение
 * уходит через ProactiveSender.notify. Нет автора, адресата или его
 * telegramId — предупреждение в лог, сообщение не отправляется. Риск
 * (принят): отзыв сохранён, а доставка могла не пройти — как в legacy.
 */
export class ReviewNotifyStory extends U7BotUiStory {
  readonly name = 'review-notify';

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription<ReviewCreatedEvent>(
        ReviewEvents.created.name,
        (event) => this.#handleCreated(event),
      ),
    ];
  }

  async #handleCreated(event: ReviewCreatedEvent): Promise<void> {
    const { authorId, recipientId, direction, reviewId } = event.payload;

    const users: Profile[] = await this.findUsers([authorId, recipientId]);
    const author = users.find((u) => u.uuid === authorId);
    const telegramId = users.find((u) => u.uuid === recipientId)?.telegramId;

    if (!author || telegramId === undefined) {
      this.logger?.warn(
        this.name,
        'Уведомление об отзыве не отправлено: нет автора или telegramId адресата',
        { reviewId, authorId, recipientId },
      );
      return;
    }

    await this.proactiveSender.notify(telegramId, {
      text: this.#text(author.name, direction),
    });
  }

  /** Текст уведомления: роль автора — по направлению «кто о ком» (тексты legacy). */
  #text(
    authorName: string,
    direction: ReviewCreatedEvent['payload']['direction'],
  ): MdText {
    const role =
      direction === 'student_student'
        ? 'твой соученик'
        : direction === 'student_mentor'
          ? 'твой студент'
          : 'твой ментор';
    return md`✍️ У тебя новый отзыв — автор ${authorName}, ${role}\\. Читать: «💬 Отзывы» в карточке потока\\.`;
  }

  // ── Стори не интерактивна: уведомление — единственный выход ──

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    return this.unknownCommand(action, actor, session);
  }
}
