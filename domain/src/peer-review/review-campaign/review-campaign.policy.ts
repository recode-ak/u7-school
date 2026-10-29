import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { ReviewCampaignAr } from './review-campaign.ar';

/** Контекст правил кампании: кампания, над которой действие. */
export type ReviewCampaignCtx = {
  readonly campaign: ReadonlyAr<ReviewCampaignAr>;
};

const isWindowAuthor = Rule.of({
  name: 'isWindowAuthor',
  label: 'Автор окна',
  denyMessage:
    'Работать с окном отзывов могут только его субъект и ментор потока.',
  check: (subject: { readonly uuid: string }, ctx: ReviewCampaignCtx) =>
    ctx.campaign.authorRoleOf(subject.uuid) !== undefined,
});

/**
 * Права на кампанию отзывов: автор окна — его субъект или ментор потока.
 * Создание — реакция системы на событие студента, субъекта нет.
 */
export const ReviewCampaignPolicy = PolicyDef.define({
  name: 'review-campaign',
  label: 'Права на кампании отзывов',
  description: 'Кто может работать с окном отзывов: субъект окна и его ментор.',
  rules: {
    isWindowAuthor,
  },
});
