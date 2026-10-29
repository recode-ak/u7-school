import type {
  AccessDeniedError,
  ConflictError,
  NotFoundError,
} from '@u7-scl/core/domain'; // DEBT-25
import type {
  ReviewDuplicateUcError,
  ReviewTextInvalidUcError,
} from './review/errors';

// TR: четыре legacy-ошибки ниже бросает мост `create-review-uc` (коды прежние)
// до среза `review` (Ф2): там они станут `REVIEW_*` и переедут в Def.

/** Кампания отзывов не найдена (мост `create-review-uc`). */
export type CampaignNotFoundUcError = NotFoundError<
  'PEER_REVIEW_CAMPAIGN_NOT_FOUND',
  { campaignId: string }
>;

/** Окно кампании закрыто: писать и перезаписывать отзывы уже нельзя. */
export type ReviewWindowClosedUcError = ConflictError<
  'REVIEW_WINDOW_CLOSED',
  { campaignId: string; expiresAt: string }
>;

/** Автор не субъект этого окна и не его ментор — писать здесь не может. */
export type PeerReviewNotParticipantUcError =
  AccessDeniedError<'PEER_REVIEW_NOT_PARTICIPANT'>;

/** Адресат вне списка допустимых политикой для роли автора. */
export type RecipientNotAllowedUcError = ConflictError<
  'PEER_REVIEW_RECIPIENT_NOT_ALLOWED',
  { campaignId: string; authorId: string; recipientId: string }
>;

export type PeerReviewUcErrors =
  | CampaignNotFoundUcError
  | PeerReviewNotParticipantUcError
  | RecipientNotAllowedUcError
  | ReviewWindowClosedUcError
  | ReviewDuplicateUcError
  | ReviewTextInvalidUcError;
