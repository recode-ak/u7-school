import type { Timestamp } from 'dmg-core';
import { DomainRuleDef, err, ok, type ReadonlyAr, RulesDef } from 'dmg-core';
import type { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';
import {
  REVIEW_TEXT_MAX_LENGTH,
  REVIEW_TEXT_MIN_LENGTH,
} from './review.constants';
import { ReviewErrors } from './review.errors';

/** Контекст правила окна: кампания и текущий момент (даёт `load`). */
export type WindowOpenCtx = {
  readonly campaign: ReadonlyAr<ReviewCampaignAr>;
  readonly at: Timestamp;
};

/** Контекст правила адресата: кампания, автор и адресат из входа. */
export type RecipientAllowedCtx = {
  readonly campaign: ReadonlyAr<ReviewCampaignAr>;
  readonly authorId: string;
  readonly recipientId: string;
};

/** Контекст правила текста. */
export type ValidTextCtx = { readonly text: string };

/** Окно открыто: `at < expiresAt`, граница включительно закрывает. */
const windowOpen = DomainRuleDef.define({
  name: 'windowOpen',
  label: 'Окно кампании открыто',
  description:
    'Писать и перезаписывать отзыв можно, пока окно кампании не закрылось (в момент expiresAt оно уже закрыто).',
  error: ReviewErrors.WINDOW_CLOSED,
  check: ({ campaign, at }: WindowOpenCtx) =>
    campaign.isExpired(at)
      ? err(
          ReviewErrors.WINDOW_CLOSED.make({
            campaignId: campaign.uuid,
            expiresAt: campaign.expiresAt,
          }),
        )
      : ok(),
});

/** Адресат входит в допустимые для роли автора (`targetIdsFor`). */
const recipientAllowed = DomainRuleDef.define({
  name: 'recipientAllowed',
  label: 'Адресат допустим для роли автора',
  description:
    'Адресат отзыва должен входить в адресатов автора окна: субъект пишет соученикам и ментору, ментор — субъекту.',
  error: ReviewErrors.RECIPIENT_NOT_ALLOWED,
  check: ({ campaign, authorId, recipientId }: RecipientAllowedCtx) =>
    campaign.targetIdsFor(authorId).includes(recipientId)
      ? ok()
      : err(
          ReviewErrors.RECIPIENT_NOT_ALLOWED.make({
            campaignId: campaign.uuid,
            authorId,
            recipientId,
          }),
        ),
});

/** Текст отзыва — от `REVIEW_TEXT_MIN_LENGTH` до `REVIEW_TEXT_MAX_LENGTH`. */
const validText = DomainRuleDef.define({
  name: 'validText',
  label: 'Допустимая длина текста',
  description: `Текст отзыва — от ${REVIEW_TEXT_MIN_LENGTH} до ${REVIEW_TEXT_MAX_LENGTH} символов.`,
  error: ReviewErrors.TEXT_INVALID,
  check: ({ text }: ValidTextCtx) =>
    text.length < REVIEW_TEXT_MIN_LENGTH || text.length > REVIEW_TEXT_MAX_LENGTH
      ? err(
          ReviewErrors.TEXT_INVALID.make({
            min: REVIEW_TEXT_MIN_LENGTH,
            max: REVIEW_TEXT_MAX_LENGTH,
            length: text.length,
          }),
        )
      : ok(),
});

export const ReviewRules = RulesDef.define({
  name: 'review',
  label: 'Правила отзывов',
  description:
    'Доменные правила без субъекта: окно открыто, адресат допустим, текст нужной длины.',
  rules: { windowOpen, recipientAllowed, validText },
});
