/**
 * Контракт модуля peer-review: паспорт, Def операций кампаний, события и
 * ошибки; Ar, Policy и DQS — по нужде зависимых (D-45, D-69).
 */
export { PeerReviewModuleDef } from './peer-review.module';
export { ReviewErrors } from './review/review.errors';
/** Кто: подписчик уведомления адресату (story бота). Зачем: событие первой записи отзыва. */
export { ReviewEvents } from './review/review.events';
/** Кто: stories и тесты бота. Зачем: направление отзывов и их снимки. */
export type { ReviewDirection } from './review/review.state';
export type {
  RecipientReviewsGroup,
  ReviewFilter,
  ReviewSnapshot,
} from './review/review.types';
/** Кто: stories бота. Зачем: написать или перезаписать отзыв. */
export { CreateReviewUcDef } from './review/uc/create-review.uc';
/** Кто: stories бота. Зачем: мой отзыв адресату. */
export { GetMyReviewUcDef, type MyReview } from './review/uc/get-my-review.uc';
/** Кто: stories бота. Зачем: «Отзывы мне». */
export {
  ListMyReviewsUcDef,
  type MyReviewsProjection,
} from './review/uc/list-my-reviews.uc';
/** Кто: модуль streams (карточка потока). Зачем: факты отзывов скоупа. */
export {
  ListScopeFactsUcDef,
  type ScopeFacts,
} from './review/uc/list-scope-facts.uc';
/** Кто: stories бота. Зачем: отзывы скоупов по адресатам. */
export {
  ListScopeReviewsUcDef,
  type ScopeReviewsProjection,
} from './review/uc/list-scope-reviews.uc';
export { CreateStudentCampaignErDef } from './review-campaign/er/create-student-campaign.er';
export { ReviewCampaignErrors } from './review-campaign/review-campaign.errors';
/** Кто: ER создания кампании, адаптеры. Зачем: событие открытия окна. */
export { ReviewCampaignEvents } from './review-campaign/review-campaign.events';
/** Кто: stories бота. Зачем: адресаты автора в окне. */
export {
  GetCampaignRecipientsUcDef,
  type MyRecipientsView,
} from './review-campaign/uc/get-campaign-recipients.uc';
/** Кто: stories бота. Зачем: список «моих кампаний». */
export {
  GetMyCampaignsUcDef,
  type MyCampaignCard,
} from './review-campaign/uc/get-my-campaigns.uc';
export type { StudentOutcome } from './shared/campaign-fields';
