/**
 * Контракт модуля course: паспорт внешнего модуля (D-37), Def UC для других
 * модулей (D-42; фасад — `Facade<typeof CourseModuleDef>`, D-43),
 * legacy-фасад и ошибки.
 */
export type { ContentSnapshot } from './content-snapshot';
export { ContentSnapshotVo } from './content-snapshot';
export type {
  CourseAccessDeniedUcError,
  CourseNotFoundUcError,
} from './course/commands/errors';
export { CourseErrors } from './course/course.errors';
export {
  type CourseEnrollment,
  GetCourseEnrollmentUcDef,
} from './course/uc/get-course-enrollment.uc';
export {
  type CoursesIncludingModule,
  GetCoursesIncludingModuleUcDef,
} from './course/uc/get-courses-including-module.uc';
export {
  type CoursesStartingWithModule,
  GetCoursesStartingWithModuleUcDef,
} from './course/uc/get-courses-starting-with-module.uc';
export {
  GetModuleEnrollmentUcDef,
  type ModuleEnrollment,
} from './course/uc/get-module-enrollment.uc';
export {
  GetModulePrerequisiteUcDef,
  type ModulePrerequisite,
} from './course/uc/get-module-prerequisite.uc';
export { GetModuleSnapshotUcDef } from './course/uc/get-module-snapshot.uc';
export {
  GetSameModulesUcDef,
  type SameModules,
} from './course/uc/get-same-modules.uc';
export { CourseModuleDef } from './course.module';
export type { CourseFacade, CourseProgram, ModulePlace } from './facade';
export type {
  LessonAccessDeniedUcError,
  LessonModuleError,
  LessonNotFoundUcError,
} from './lesson/commands/errors';
export type {
  CourseModuleError,
  ModuleAccessDeniedUcError,
  ModuleNotFoundUcError,
} from './module/commands/errors';
export type { ModuleView } from './module/module.ar';
export { ModuleErrors } from './module/module.errors';
export { GetModuleUcDef } from './module/uc/get-module.uc';
export { ListModulesUcDef } from './module/uc/list-modules.uc';
export type {
  StepAccessDeniedUcError,
  StepModuleError,
  StepNotFoundUcError,
} from './step/commands/errors';
