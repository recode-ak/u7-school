import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import type { ReviewRepo } from './review/review.repo';
import { CreateReviewUc } from './review/uc/create-review.uc';
import { GetMyReviewUc } from './review/uc/get-my-review.uc';
import { ListMyReviewsUc } from './review/uc/list-my-reviews.uc';
import { ListScopeFactsUc } from './review/uc/list-scope-facts.uc';
import { ListScopeReviewsUc } from './review/uc/list-scope-reviews.uc';
import { CreateStudentCampaignEr } from './review-campaign/er/create-student-campaign.er';
import type { ReviewCampaignRepo } from './review-campaign/review-campaign.repo';
import { GetCampaignRecipientsUc } from './review-campaign/uc/get-campaign-recipients.uc';
import { GetMyCampaignsUc } from './review-campaign/uc/get-my-campaigns.uc';
// gen:defs:imports

/**
 * Резолвер модуля: платформа, фасады зависимостей (`facades` — состав потока
 * из `stream`; вызываемые UC — в `calls` операций, D-43), репозитории
 * кампаний и отзывов.
 */
export type PeerReviewDeps = ModuleDeps & {
  readonly campaigns: ReviewCampaignRepo;
  readonly reviews: ReviewRepo;
  // gen:deps
};

/** Карта «Def → класс» модуля peer-review (API-05). */
export const peerReviewMap = {
  useCases: {
    getMyCampaigns: GetMyCampaignsUc,
    getCampaignRecipients: GetCampaignRecipientsUc,
    createReview: CreateReviewUc,
    getMyReview: GetMyReviewUc,
    listMyReviews: ListMyReviewsUc,
    listScopeReviews: ListScopeReviewsUc,
    listScopeFacts: ListScopeFactsUc,
    // gen:defs:useCases
  },
  reactions: {
    createStudentCampaign: CreateStudentCampaignEr,
    // gen:defs:reactions
  },
  jobs: {
    // gen:defs:jobs
  },
} satisfies ModuleMap<typeof PeerReviewModuleDef, PeerReviewDeps, Identified>;

/** Модуль peer-review с зависимостями — для сборки приложения. */
export function createPeerReviewModule(deps: PeerReviewDeps) {
  return new ModuleFromDef<
    typeof PeerReviewModuleDef,
    PeerReviewDeps,
    Identified
  >(PeerReviewModuleDef, peerReviewMap, deps);
}
