// DEBT-21
import type { ApiModuleMeta } from '@u7-scl/core/domain';
import type { CancelWishCmdMeta } from './wish/commands/cancel-wish-cmd';
import type { CreateCourseWishCmdMeta } from './wish/commands/create-course-wish-cmd';
import type { CreateModuleWishCmdMeta } from './wish/commands/create-module-wish-cmd';
import type { ListUserWishesCmdMeta } from './wish/commands/list-user-wishes-cmd';

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
