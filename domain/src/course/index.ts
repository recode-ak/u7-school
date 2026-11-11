// Domain слой @u7-scl/course

// Снимок контента модуля
export type {
  ContentSnapshot,
  ContentSnapshotItem,
  StepPosition,
} from './content-snapshot';
export {
  ContentSnapshotItemSchema,
  ContentSnapshotSchema,
  LessonSnapshotSchema,
} from './content-snapshot';
// Курс
export type {
  CourseStage,
  CourseView,
  ModulePlaceInCourse,
} from './course/course.ar';
export { CourseAr, CourseArDef } from './course/course.ar';
export { CourseErrors } from './course/course.errors';
export type { CourseState, PhaseVo } from './course/course.state';
export { CourseProgramInvariant } from './course/course.state';
export type { ModulePlace } from './course/uc/get-module-place.uc';
export type { ModulePrerequisite } from './course/uc/get-module-prerequisite.uc';
// Агрегат Lesson
export type { LessonOutline, LessonView } from './lesson/lesson.ar';
export { LessonAr, LessonArDef } from './lesson/lesson.ar';
export { LessonErrors } from './lesson/lesson.errors';
export type { LessonState } from './lesson/lesson.state';
// DQS шагов уроков
export { LessonStepsDqs } from './lesson-steps.dqs';
// Агрегат Module
export type {
  ModuleSummary,
  ModuleView,
  ProjectOutline,
} from './module/module.ar';
export { ModuleAr, ModuleArDef } from './module/module.ar';
export { ModuleErrors } from './module/module.errors';
export { ModulePolicy } from './module/module.policy';
export type { ModuleState, ProjectEntity } from './module/module.state';
// DQS курса: курс модуля и вердикт пререквизита
export { ModuleCoursesDqs } from './module-courses.dqs';
export { ModulePrerequisiteDqs } from './module-prerequisite.dqs';
// DQS снимка контента модуля
export { ModuleSnapshotDqs } from './module-snapshot.dqs';
// Общие типы
export { Status, StatusSchema } from './status';
// Агрегат Step
export type { StepSummary, StepView } from './step/step.ar';
export { StepAr, StepArDef } from './step/step.ar';
export { StepErrors } from './step/step.errors';
export type { FileVo, StepState } from './step/step.state';
