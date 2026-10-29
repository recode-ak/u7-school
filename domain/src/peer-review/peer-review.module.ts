import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { CreateStudentCampaignErDef } from './review-campaign/er/create-student-campaign.er';
import { ReviewCampaignArDef } from './review-campaign/review-campaign.ar';
import { GetCampaignRecipientsUcDef } from './review-campaign/uc/get-campaign-recipients.uc';
import { GetMyCampaignsUcDef } from './review-campaign/uc/get-my-campaigns.uc';

/**
 * Модуль взаимных проверок. Кампании отзывов — Def (агрегат, 2 UC, ER);
 * UC рецензий и уведомление адресата пока в legacy `PeerReviewApiModule`
 * (срезы `review` и Ф3).
 */
export const PeerReviewModuleDef = ModuleDef.define({
  name: 'peer-review',
  label: 'Взаимные проверки',
  description: 'Кампании и рецензии взаимных проверок студентов.',
  dependsOn: [UserModuleDef, QuestionnaireModuleDef, StreamModuleDef],
  aggregates: [ReviewCampaignArDef],
  useCases: [GetMyCampaignsUcDef, GetCampaignRecipientsUcDef],
  reactions: [CreateStudentCampaignErDef],
  jobs: [],
});
