/** Контракт модуля course: фасад, ошибки. */
export type {
  CourseAccessDeniedUcError,
  CourseNotFoundUcError,
} from './course/commands/errors';
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
