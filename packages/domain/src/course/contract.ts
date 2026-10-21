/**
 * Контракт модуля course: паспорт внешнего модуля (D-37), Def UC для других
 * модулей и тип фасада (D-42), legacy-фасад и ошибки.
 */
export type {
  CourseAccessDeniedUcError,
  CourseNotFoundUcError,
} from './course/commands/errors';
export { CourseArDef } from './course/course.ar';
export { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';
export type { CourseEnrollment, CourseModuleFacade } from './course.facade';
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
