/**
 * Контракт модуля peer-review: паспорт, Def операций кампаний, события и
 * ошибки. Ar, Policy, Rules, DQS, ArDef и схемы entity сюда не входят.
 */
export * from './errors';
export { PeerReviewModuleDef } from './peer-review.module';
/** Кто: stories и тесты бота. Зачем: типы исхода, направления и отзыва (срез review — Ф2). */
export type { Review, ReviewDirection } from './review/entity';
export * from './review/errors';
export type { RecipientReviewsGroup } from './review/scope-reviews-ds';
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
