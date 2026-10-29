import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ReviewArDef } from '../review.ar';

/** Факты отзывов скоупа (ФР-8): есть ли отзывы и сколько. Читает всё — `allowAll`. */
export const ListScopeFactsUcDef = UseCaseDef.define({
  name: 'listScopeFacts',
  label: 'Факты отзывов скоупа',
  description: 'Есть ли в скоупе отзывы и сколько их.',
  type: 'query',
  aggregate: ReviewArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ scopeId: F.uuid('скоупа') }),
  output: v.object({
    hasReviews: F.boolean('в скоупе есть отзывы'),
    reviewsCount: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.description('Число отзывов скоупа'),
    ),
  }),
  errors: [],
});

/** Факты отзывов скоупа — для UI и внешних модулей. */
export type ScopeFacts = OutputOf<typeof ListScopeFactsUcDef>;
