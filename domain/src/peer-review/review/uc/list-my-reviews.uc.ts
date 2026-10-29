import { allowAll, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ReviewArDef } from '../review.ar';
import { ReviewFilterSchema, ReviewSnapshotSchema } from '../review.types';

/**
 * «Отзывы мне»: отзывы, адресованные вызывающему; новые наверху
 * (`createdAt` ↓, затем `uuid` ↓). Адресат — субъект, поэтому `allowAll`.
 * Фильтр передаётся репозиторию.
 */
export const ListMyReviewsUcDef = UseCaseDef.define({
  name: 'listMyReviews',
  label: 'Отзывы мне',
  description: 'Плоский список отзывов, адресованных пользователю.',
  type: 'query',
  aggregate: ReviewArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ filter: v.optional(ReviewFilterSchema) }),
  output: v.object({
    reviews: v.pipe(
      v.array(ReviewSnapshotSchema),
      v.description('Новые наверху'),
    ),
  }),
  errors: [],
});

/** Проекция «Отзывы мне» — для UI и внешних модулей. */
export type MyReviewsProjection = OutputOf<typeof ListMyReviewsUcDef>;
