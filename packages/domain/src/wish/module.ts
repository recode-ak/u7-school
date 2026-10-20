// DEBT-22
// biome-ignore lint/style/noRestrictedImports: DEBT-22 — тип резолвера пока в app
import type { U7ModuleResolver } from '@u7-scl/app/domain';
// DEBT-21
import type { ApiModuleMeta } from '@u7-scl/core/domain';
import type { CourseFacade } from '@u7-scl/domain/course';
import type { QuestionnaireFacade } from '@u7-scl/domain/questionnaire';
import type { StreamFacade } from '@u7-scl/domain/stream';
import type { UserFacade } from '@u7-scl/domain/user';
import type { CancelWishCmdMeta } from './wish/commands/cancel-wish-cmd';
import type { CreateCourseWishCmdMeta } from './wish/commands/create-course-wish-cmd';
import type { CreateModuleWishCmdMeta } from './wish/commands/create-module-wish-cmd';
import type { ListUserWishesCmdMeta } from './wish/commands/list-user-wishes-cmd';
import type { WishRepo } from './wish/repo';

export type WishUcMetas =
  | CreateCourseWishCmdMeta
  | CreateModuleWishCmdMeta
  | CancelWishCmdMeta
  | ListUserWishesCmdMeta;

/** Метаданные API-модуля wish. */
export interface WishApiModuleMeta extends ApiModuleMeta {
  name: 'wish';
  url: '/wish';
  ucMetas: WishUcMetas;
}

/** Резолвер зависимостей API-модуля wish. */
export interface WishApiModuleResolver extends U7ModuleResolver {
  wishRepo: WishRepo;
  courseFacade: CourseFacade;
  streamFacade: StreamFacade;
  questionnaireFacade: QuestionnaireFacade;
  userFacade: UserFacade;
}
