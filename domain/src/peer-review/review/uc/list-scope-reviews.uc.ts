import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ReviewArDef } from '../review.ar';
import {
  RecipientReviewsGroupSchema,
  ReviewFilterSchema,
} from '../review.types';

/**
 * Отзывы скоупов, сгруппированные по адресатам. Отзывы доступны всем
 * (`allowAll`); фильтр передаётся репозиторию. Пустой `scopeIds` — пустой
 * список.
 */
export const ListScopeReviewsUcDef = UseCaseDef.define({
  name: 'listScopeReviews',
  label: 'Отзывы скоупов',
  description:
    'Отзывы списка скоупов по адресатам: группы в порядке первого появления, внутри — по времени создания.',
  type: 'query',
  aggregate: ReviewArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({
    scopeIds: v.pipe(
      v.array(F.uuid('скоупа')),
      v.description('Идентификаторы скоупов'),
    ),
    filter: v.optional(ReviewFilterSchema),
  }),
  output: v.object({
    scopeIds: v.pipe(
      v.array(F.uuid('скоупа')),
      v.description('Идентификаторы скоупов'),
    ),
    recipients: v.pipe(
      v.array(RecipientReviewsGroupSchema),
      v.description('Группы отзывов по адресатам'),
    ),
  }),
  errors: [],
});

/** Проекция отзывов скоупов — для UI и внешних модулей. */
export type ScopeReviewsProjection = OutputOf<typeof ListScopeReviewsUcDef>;
