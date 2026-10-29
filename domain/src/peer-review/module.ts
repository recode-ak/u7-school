// DEBT-26
// biome-ignore lint/style/noRestrictedImports: DEBT-26 — тип резолвера пока в app
import type { U7ModuleResolver } from '@u7-scl/app-legacy/domain';
import type { StreamFacade } from '@u7-scl/domain/stream/contract';
import type { UserFacade } from '@u7-scl/domain/user/contract';

/**
 * Резолвер зависимостей API-модуля peer-review.
 */
export interface PeerReviewApiModuleResolver extends U7ModuleResolver {
  /** Состав окружения субъекта окна (ментор + студенты с исходами). */
  streamFacade: StreamFacade;
  /** Имена автора/адресата и доставка уведомлений (notify). */
  userFacade: UserFacade;
}

/**
 * Метаданные API-модуля peer-review.
 */
export interface PeerReviewApiModuleMeta {
  name: 'peer-review';
  url: '/peer-review';
  ucMetas: never;
}
