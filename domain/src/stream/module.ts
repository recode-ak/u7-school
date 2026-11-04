// biome-ignore lint/style/noRestrictedImports: DEBT-2 — тип резолвера пока в app
import type { U7ModuleResolver } from '@u7-scl/app-legacy/domain';
import type { CourseFacade } from '@u7-scl/domain/course/contract';
import type { UserFacade } from '@u7-scl/domain/user/contract';

/**
 * Резолвер зависимостей API-модуля stream (оболочка до Ф3 трека `stream-dmg`).
 */
export interface StreamApiModuleResolver extends U7ModuleResolver {
  userFacade: UserFacade;
  courseFacade: CourseFacade;
}

/**
 * Метаданные API-модуля stream: UC и Job переведены на Def, legacy-UC нет.
 */
export interface StreamApiModuleMeta {
  name: 'stream';
  url: '/stream';
  ucMetas: never;
}
