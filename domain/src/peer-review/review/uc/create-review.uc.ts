import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ReviewCampaignErrors } from '../../review-campaign/review-campaign.errors';
import { ReviewArDef } from '../review.ar';
import { ReviewErrors } from '../review.errors';
import { ReviewEvents } from '../review.events';
import { ReviewPolicy } from '../review.policy';
import { ReviewRules } from '../review.rules';

/**
 * Написать или перезаписать отзыв. Автор — вызывающий (`authorId` не во
 * входе). Право (автор окна) проверяется раньше правил: посторонний при
 * закрытом окне получит `ACCESS_DENIED`. Правила: окно → адресат → текст.
 * Первая запись пары создаёт отзыв и событие, повтор — перезаписывает текст
 * без события.
 */
export const CreateReviewUcDef = UseCaseDef.define({
  name: 'createReview',
  label: 'Написать отзыв',
  description:
    'Записывает отзыв автора окна об адресате; повтор той же пары перезаписывает текст.',
  type: 'command',
  aggregate: ReviewArDef,
  callers: ['user'],
  policy: ReviewPolicy.rules.isCampaignAuthor,
  rules: [
    ReviewRules.rules.windowOpen,
    ReviewRules.rules.recipientAllowed,
    ReviewRules.rules.validText,
  ],
  input: v.object({
    campaignId: F.uuid('кампании отзывов'),
    recipientId: F.uuid('адресата отзыва'),
    text: F.sensitive(v.pipe(v.string(), v.description('Текст отзыва'))),
  }),
  output: v.object({
    reviewId: F.uuid('отзыва'),
    campaignId: F.uuid('кампании отзывов'),
    recipientId: F.uuid('адресата отзыва'),
  }),
  emits: [ReviewEvents.created],
  errors: [
    ReviewCampaignErrors.NOT_FOUND,
    ReviewErrors.WINDOW_CLOSED,
    ReviewErrors.RECIPIENT_NOT_ALLOWED,
    ReviewErrors.TEXT_INVALID,
  ],
});
