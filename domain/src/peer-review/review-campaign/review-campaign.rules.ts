import { DomainRuleDef, err, ok, type ReadonlyAr, RulesDef } from 'dmg-core';
import type { ReviewCampaignAr } from './review-campaign.ar';
import { ReviewCampaignErrors } from './review-campaign.errors';

/**
 * Контекст правила уникальности: пара (скоуп, субъект) из входа и кампании,
 * загруженные UC/ER (любой набор, например кампании этого скоупа).
 */
export type UniqueReviewCampaignCtx = {
  readonly scopeId: string;
  readonly subjectId: string;
  readonly campaigns: readonly ReadonlyAr<ReviewCampaignAr>[];
};

/**
 * Одна кампания на пару (скоуп, субъект) — доменное правило без субъекта
 * (D-40). Правило само отбирает кампании этой пары и не доверяет выборке
 * вызывающего.
 */
const unique = DomainRuleDef.define({
  name: 'unique',
  label: 'Одна кампания на студента потока',
  description:
    'Кампания окна судьбы создаётся, только если для пары (скоуп, субъект) её ещё нет.',
  error: ReviewCampaignErrors.ALREADY_EXISTS,
  check: ({ scopeId, subjectId, campaigns }: UniqueReviewCampaignCtx) =>
    campaigns.some((campaign) => campaign.isFor(scopeId, subjectId))
      ? err(ReviewCampaignErrors.ALREADY_EXISTS.make({ scopeId, subjectId }))
      : ok(),
});

export const ReviewCampaignRules = RulesDef.define({
  name: 'review-campaign',
  label: 'Правила кампаний отзывов',
  description: 'Доменные правила без субъекта: уникальность кампании на пару.',
  rules: { unique },
});
