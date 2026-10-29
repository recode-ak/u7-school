import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';

/** Контекст права: кампания, в которой пишется отзыв. */
export type ReviewCtx = {
  readonly campaign: ReadonlyAr<ReviewCampaignAr>;
};

const isCampaignAuthor = Rule.of({
  name: 'isCampaignAuthor',
  label: 'Автор окна кампании',
  denyMessage: 'Писать отзывы в окне могут только его субъект и ментор потока.',
  check: (subject: { readonly uuid: string }, ctx: ReviewCtx) =>
    ctx.campaign.authorRoleOf(subject.uuid) !== undefined,
});

/** Права на отзывы: писать может автор окна кампании — субъект или ментор. */
export const ReviewPolicy = PolicyDef.define({
  name: 'review',
  label: 'Права на отзывы',
  description: 'Кто может писать отзывы в окне кампании: субъект и ментор.',
  rules: { isCampaignAuthor },
});
