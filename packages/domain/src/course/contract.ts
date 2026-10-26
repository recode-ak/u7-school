/**
 * Контракт модуля course: паспорт внешнего модуля (D-37), Def UC для других
 * модулей (D-42; фасад — `Facade<typeof CourseModuleDef>`, D-43),
 * legacy-фасад и ошибки.
 */
export type {
  CourseAccessDeniedUcError,
  CourseNotFoundUcError,
} from './course/commands/errors';
export { CourseArDef } from './course/course.ar';
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
export type {
  StepAccessDeniedUcError,
  StepModuleError,
  StepNotFoundUcError,
} from './step/commands/errors';
