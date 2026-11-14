import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { ReviewArDef } from './review/review.ar';
import { CreateReviewUcDef } from './review/uc/create-review.uc';
import { GetMyReviewUcDef } from './review/uc/get-my-review.uc';
import { ListMyReviewsUcDef } from './review/uc/list-my-reviews.uc';
import { ListScopeFactsUcDef } from './review/uc/list-scope-facts.uc';
import { ListScopeReviewsUcDef } from './review/uc/list-scope-reviews.uc';
import { CreateStudentCampaignErDef } from './review-campaign/er/create-student-campaign.er';
import { ReviewCampaignArDef } from './review-campaign/review-campaign.ar';
import { GetCampaignRecipientsUcDef } from './review-campaign/uc/get-campaign-recipients.uc';
import { GetMyCampaignsUcDef } from './review-campaign/uc/get-my-campaigns.uc';

/**
 * Модуль взаимных проверок: кампании отзывов (агрегат, 2 UC, ER) и отзывы
 * (агрегат, 5 UC). Уведомление адресата о новом отзыве — подписка story бота
 * на `ReviewEvents.created`, не ER модуля.
 */
export const PeerReviewModuleDef = ModuleDef.define({
  name: 'peer-review',
  label: 'Взаимные проверки',
  description: 'Кампании и рецензии взаимных проверок студентов.',
  dependsOn: [UserModuleDef, StreamModuleDef],
  aggregates: [ReviewCampaignArDef, ReviewArDef],
  useCases: [
    GetMyCampaignsUcDef,
    GetCampaignRecipientsUcDef,
    CreateReviewUcDef,
    GetMyReviewUcDef,
    ListMyReviewsUcDef,
    ListScopeReviewsUcDef,
    ListScopeFactsUcDef,
  ],
  reactions: [CreateStudentCampaignErDef],
  jobs: [],
});
