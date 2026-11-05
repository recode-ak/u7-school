// biome-ignore lint/style/noRestrictedImports: DEBT-2 — тип резолвера пока в app
import type { U7ModuleResolver } from '@u7-scl/app-legacy/domain';
import type { ApiModuleMeta } from '@u7-scl/core/domain';
import type { BaseJsonDb } from '@u7-scl/core/infra';
import type { UserFacade } from '@u7-scl/domain/user';
import type { ResolveContentPathCmdMeta } from './content-path/commands/resolve-content-path-cmd';
import type {
  AddModuleToCourseCmdMeta,
  AddPhaseToCourseCmdMeta,
  CreateCourseCmdMeta,
  GetCourseByModuleCmdMeta,
  GetCourseCmdMeta,
  GetCourseProgramCmdMeta,
  GetModulePlaceCmdMeta,
  ListCoursesCmdMeta,
  WhichCoursesIncludeModuleCmdMeta,
} from './course/commands';
import type { CourseRepo } from './course/repo';
import type { CreateLessonCmdMeta } from './lesson/commands/create-lesson-cmd';
import type { GetLessonCmdMeta } from './lesson/commands/get-lesson-cmd';
import type { LegacyLessonRepo } from './lesson/repo';
import type { AddProjectCmdMeta } from './module/commands/add-project-cmd';
import type { CreateModuleCmdMeta } from './module/commands/create-module-cmd';
import type { EnrichModuleCmdMeta } from './module/commands/enrich-module-cmd';
import type { GetModuleCmdMeta } from './module/commands/get-module-cmd';
import type { GetModuleSnapshotCmdMeta } from './module/commands/get-module-snapshot-cmd';
import type { ListModulesCmdMeta } from './module/commands/list-modules-cmd';
import type { PublishModuleCmdMeta } from './module/commands/publish-module-cmd';
import type { LegacyModuleRepo } from './module/repo';
import type { CreateStepCmdMeta } from './step/commands/create-step-cmd';
import type { GetStepCmdMeta } from './step/commands/get-step-cmd';
import type { GetStepsByLessonsCmdMeta } from './step/commands/get-steps-by-lessons-cmd';
import type { LegacyStepRepo } from './step/repo';

export type CourseUcMetas =
  | CreateCourseCmdMeta
  | AddPhaseToCourseCmdMeta
  | AddModuleToCourseCmdMeta
  | GetCourseCmdMeta
  | GetCourseByModuleCmdMeta
  | GetCourseProgramCmdMeta
  | GetModulePlaceCmdMeta
  | ListCoursesCmdMeta
  | WhichCoursesIncludeModuleCmdMeta
  | ResolveContentPathCmdMeta;

export type ModuleUcMetas =
  | AddProjectCmdMeta
  | CreateModuleCmdMeta
  | EnrichModuleCmdMeta
  | GetModuleCmdMeta
  | GetModuleSnapshotCmdMeta
  | ListModulesCmdMeta
  | PublishModuleCmdMeta
  | CreateLessonCmdMeta
  | GetLessonCmdMeta
  | CreateStepCmdMeta
  | GetStepCmdMeta
  | GetStepsByLessonsCmdMeta;

export type AllUcMetas = ModuleUcMetas | CourseUcMetas;

/** Метаданные модуля course (имя пакета @u7-scl/course) */
export interface CourseApiModuleMeta extends ApiModuleMeta {
  name: 'course';
  url: '/course';
  ucMetas: AllUcMetas;
}

/** Резолвер зависимостей API-модуля курсов */
export interface CourseApiModuleResolver extends U7ModuleResolver {
  db?: BaseJsonDb;
  moduleRepo: LegacyModuleRepo;
  courseRepo: CourseRepo;
  lessonRepo: LegacyLessonRepo;
  stepRepo: LegacyStepRepo;
  userFacade: UserFacade;
}
