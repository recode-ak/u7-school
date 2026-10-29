import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';
import { ReviewDirectionSchema } from './review.state';

/**
 * События агрегата `review`.
 *
 * `created` — отзыв записан впервые. Перезапись текста события не создаёт:
 * повторное уведомление адресата было бы спамом.
 */
export const ReviewEvents = EventDef.define('peer-review.review', {
  created: {
    label: 'Отзыв записан впервые',
    description:
      'Первая запись отзыва парой (кампания, автор, адресат); подписчик уведомляет адресата.',
    payload: v.object({
      reviewId: F.uuid('отзыва'),
      campaignId: F.uuid('кампании отзывов'),
      scopeId: F.uuid('скоупа (потока) — для адресации UI-подписчиков'),
      authorId: F.uuid('автора отзыва'),
      recipientId: F.uuid('адресата отзыва'),
      direction: ReviewDirectionSchema,
    }),
  },
});
