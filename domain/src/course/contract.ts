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
export type { CourseStage } from './course/course.ar';
export { CourseView } from './course/course.ar';
export { CourseErrors } from './course/course.errors';
export { GetCourseUcDef } from './course/uc/get-course.uc';
export { GetCourseByModuleUcDef } from './course/uc/get-course-by-module.uc';
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
  GetModulePlaceUcDef,
  type ModulePlace,
} from './course/uc/get-module-place.uc';
export {
  GetModulePrerequisiteUcDef,
  type ModulePrerequisite,
} from './course/uc/get-module-prerequisite.uc';
export {
  GetSameModulesUcDef,
  type SameModules,
} from './course/uc/get-same-modules.uc';
export { ListCoursesUcDef } from './course/uc/list-courses.uc';
export { CourseModuleDef } from './course.module';
export type {
  LessonAccessDeniedUcError,
  LessonModuleError,
  LessonNotFoundUcError,
} from './lesson/commands/errors';
export type { LessonView } from './lesson/lesson.ar';
export { LessonErrors } from './lesson/lesson.errors';
export { GetLessonUcDef } from './lesson/uc/get-lesson.uc';
export type {
  CourseModuleError,
  ModuleAccessDeniedUcError,
  ModuleNotFoundUcError,
} from './module/commands/errors';
export type { ModuleSummary, ModuleView } from './module/module.ar';
export { ModuleErrors } from './module/module.errors';
export { GetModuleUcDef } from './module/uc/get-module.uc';
export { GetModuleSnapshotUcDef } from './module/uc/get-module-snapshot.uc';
export { ListModulesUcDef } from './module/uc/list-modules.uc';
export type {
  StepAccessDeniedUcError,
  StepModuleError,
  StepNotFoundUcError,
} from './step/commands/errors';
export type { StepView } from './step/step.ar';
export { StepErrors } from './step/step.errors';
export { GetStepUcDef } from './step/uc/get-step.uc';
export {
  GetStepsByLessonsUcDef,
  type StepsByLesson,
} from './step/uc/get-steps-by-lessons.uc';
