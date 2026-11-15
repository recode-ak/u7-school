import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ReviewArDef } from '../review.ar';

/**
 * Мой отзыв адресату в кампании. Автор — вызывающий (в входе его нет),
 * чужие отзывы не читаются, поэтому `allowAll`.
 */
export const GetMyReviewUcDef = UseCaseDef.define({
  name: 'getMyReview',
  label: 'Мой отзыв адресату',
  description: 'Текст моего отзыва адресату в кампании, если он уже написан.',
  type: 'query',
  aggregate: ReviewArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({
    campaignId: F.uuid('кампании отзывов'),
    recipientId: F.uuid('адресата отзыва'),
  }),
  output: v.object({
    found: F.boolean('отзыв найден'),
    text: v.optional(
      F.sensitive(v.pipe(v.string(), v.description('Текст отзыва'))),
    ),
  }),
  errors: [],
});

/** Мой отзыв — для UI и внешних модулей. */
export type MyReview = OutputOf<typeof GetMyReviewUcDef>;
