// DEBT-26
// biome-ignore lint/style/noRestrictedImports: DEBT-26 — тип резолвера пока в app
import type { U7ModuleResolver } from '@u7-scl/app-legacy/domain';
import type { StreamFacade } from '@u7-scl/domain/stream/contract';
import type { UserFacade } from '@u7-scl/domain/user/contract';
import type { CreateReviewCmdMeta } from './review/commands/create-review-cmd';
import type { GetMyReviewCmdMeta } from './review/commands/get-my-review-cmd';
import type { ListMyReviewsCmdMeta } from './review/commands/list-my-reviews-cmd';
import type { ListScopeFactsCmdMeta } from './review/commands/list-scope-facts-cmd';
import type { ListScopeReviewsCmdMeta } from './review/commands/list-scope-reviews-cmd';
import type { ReviewRepo } from './review/repo';
import type { ReviewCampaignAr } from './review-campaign/review-campaign.ar';

/**
 * Резолвер зависимостей API-модуля peer-review.
 */
export interface PeerReviewApiModuleResolver extends U7ModuleResolver {
  /**
   * Чтение кампании для моста `create-review-uc` (TR, до среза `review`, Ф2):
   * порт нового прикладного слоя, узкий срез.
   */
  reviewCampaignRepo: {
    findById(uuid: string): Promise<ReviewCampaignAr | undefined>;
  };
  reviewRepo: ReviewRepo;
  /** Состав окружения субъекта окна (ментор + студенты с исходами). */
  streamFacade: StreamFacade;
  /** Имена автора/адресата и доставка уведомлений (notify). */
  userFacade: UserFacade;
}

/** Меты UC модуля peer-review (ФР-7). */
export type PeerReviewUcMetas =
  | CreateReviewCmdMeta
  | GetMyReviewCmdMeta
  | ListMyReviewsCmdMeta
  | ListScopeReviewsCmdMeta
  | ListScopeFactsCmdMeta;

/**
 * Метаданные API-модуля peer-review.
 */
export interface PeerReviewApiModuleMeta {
  name: 'peer-review';
  url: '/peer-review';
  ucMetas: PeerReviewUcMetas;
}
