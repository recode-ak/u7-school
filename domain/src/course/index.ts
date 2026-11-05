// Domain слой @u7-scl/course

// ContentPath VO
export type { ContentPath } from './content-path';
export {
  ContentPathSchema,
  parse as parseContentPath,
  serialize as serializeContentPath,
} from './content-path';
export type {
  LessonNotFoundInPathUcError,
  ModuleNotFoundInPathUcError,
  ProjectNotFoundInPathUcError,
  ResolveContentPathCmd,
  ResolveContentPathCmdMeta,
  StepNotFoundInPathUcError,
} from './content-path/commands/resolve-content-path-cmd';
export { ResolveContentPathSchema } from './content-path/commands/resolve-content-path-cmd';
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
// Агрегат Course
export { LegacyCourseAr } from './course/a-root';
export type {
  AddModuleToCourseCmd,
  AddModuleToCourseCmdMeta,
} from './course/commands/add-module-to-course-cmd';
export { AddModuleToCourseCmdSchema } from './course/commands/add-module-to-course-cmd';
export type {
  AddPhaseToCourseCmd,
  AddPhaseToCourseCmdMeta,
} from './course/commands/add-phase-to-course-cmd';
export { AddPhaseToCourseCmdSchema } from './course/commands/add-phase-to-course-cmd';
export type {
  CreateCourseCmd,
  CreateCourseCmdMeta,
} from './course/commands/create-course-cmd';
export { CreateCourseCmdSchema } from './course/commands/create-course-cmd';
export type {
  CourseAccessDeniedUcError,
  CourseNotFoundUcError,
} from './course/commands/errors';
// Команды и типы, нужные прикладному слою (api/infra)
export type {
  GetCourseByModuleCmd,
  GetCourseByModuleCmdMeta,
} from './course/commands/get-course-by-module-cmd';
export { GetCourseByModuleCmdSchema } from './course/commands/get-course-by-module-cmd';
export type {
  GetCourseCmd,
  GetCourseCmdMeta,
} from './course/commands/get-course-cmd';
export { GetCourseCmdSchema } from './course/commands/get-course-cmd';
export type {
  GetCourseProgramCmd,
  GetCourseProgramCmdMeta,
} from './course/commands/get-course-program-cmd';
export {
  CourseProgramSchema,
  GetCourseProgramCmdSchema,
} from './course/commands/get-course-program-cmd';
export type {
  GetModulePlaceCmd,
  GetModulePlaceCmdMeta,
} from './course/commands/get-module-place-cmd';
export {
  GetModulePlaceCmdSchema,
  ModulePlaceSchema,
} from './course/commands/get-module-place-cmd';
export type {
  ListCoursesCmd,
  ListCoursesCmdMeta,
} from './course/commands/list-courses-cmd';
export { ListCoursesCmdSchema } from './course/commands/list-courses-cmd';
export type {
  WhichCoursesIncludeModuleCmd,
  WhichCoursesIncludeModuleCmdMeta,
} from './course/commands/which-courses-include-module-cmd';
export { WhichCoursesIncludeModuleCmdSchema } from './course/commands/which-courses-include-module-cmd';
export type { Course, CourseArMeta, Phase } from './course/entity';
export { CourseSchema, PhaseSchema } from './course/entity';
export { LegacyCoursePolicy } from './course/policy';
export type { CourseListFilter, LegacyCourseRepo } from './course/repo';
// Domain Service
export { CourseDs } from './course-ds';
export type { CourseFacade, CourseProgram, ModulePlace } from './facade';
// Агрегат Lesson: новый и legacy (`Legacy*`) — legacy живёт рядом
export { LegacyLessonAr } from './lesson/a-root';
export type {
  CreateLessonCmd,
  CreateLessonCmdError,
  CreateLessonCmdMeta,
} from './lesson/commands/create-lesson-cmd';
export { CreateLessonCmdSchema } from './lesson/commands/create-lesson-cmd';
export type {
  LessonAccessDeniedUcError,
  LessonModuleError,
  LessonNotFoundUcError,
} from './lesson/commands/errors';
export type {
  GetLessonCmd,
  GetLessonCmdError,
  GetLessonCmdMeta,
} from './lesson/commands/get-lesson-cmd';
export { GetLessonCmdSchema } from './lesson/commands/get-lesson-cmd';
export type { Lesson, LessonArMeta } from './lesson/entity';
export { LessonSchema } from './lesson/entity';
export type { LessonOutline, LessonView } from './lesson/lesson.ar';
export { LessonAr, LessonArDef } from './lesson/lesson.ar';
export { LessonErrors } from './lesson/lesson.errors';
export type { LessonState } from './lesson/lesson.state';
export { LegacyLessonPolicy } from './lesson/policy';
export type { LegacyLessonRepo } from './lesson/repo';
// DQS шагов уроков
export { LessonStepsDqs } from './lesson-steps.dqs';
export type { CourseApiModuleMeta, CourseApiModuleResolver } from './module';
// Агрегат Module
export { LegacyModuleAr } from './module/a-root';
export type {
  AddProjectCmd,
  AddProjectCmdError,
  AddProjectCmdMeta,
} from './module/commands/add-project-cmd';
export { AddProjectCmdSchema } from './module/commands/add-project-cmd';
export type {
  CreateModuleCmd,
  CreateModuleCmdError,
  CreateModuleCmdMeta,
} from './module/commands/create-module-cmd';
export { CreateModuleCmdSchema } from './module/commands/create-module-cmd';
export type {
  EnrichModuleCmd,
  EnrichModuleCmdError,
  EnrichModuleCmdMeta,
} from './module/commands/enrich-module-cmd';
export { EnrichModuleCmdSchema } from './module/commands/enrich-module-cmd';
export type {
  CourseModuleError,
  ModuleAccessDeniedUcError,
  ModuleNotFoundUcError,
} from './module/commands/errors';
export type {
  GetModuleCmd,
  GetModuleCmdError,
  GetModuleCmdMeta,
} from './module/commands/get-module-cmd';
export { GetModuleCmdSchema } from './module/commands/get-module-cmd';
export type {
  GetModuleSnapshotCmd,
  GetModuleSnapshotCmdError,
  GetModuleSnapshotCmdMeta,
} from './module/commands/get-module-snapshot-cmd';
export { GetModuleSnapshotCmdSchema } from './module/commands/get-module-snapshot-cmd';
export type {
  ListModulesCmd,
  ListModulesCmdMeta,
} from './module/commands/list-modules-cmd';
export { ListModulesCmdSchema } from './module/commands/list-modules-cmd';
export type {
  PublishModuleCmd,
  PublishModuleCmdError,
  PublishModuleCmdMeta,
} from './module/commands/publish-module-cmd';
export { PublishModuleCmdSchema } from './module/commands/publish-module-cmd';
export type {
  Module,
  ModuleArMeta,
  Project,
} from './module/entity';
export {
  ModuleSchema,
  ProjectSchema,
} from './module/entity';
export type { ModuleSummary, ProjectOutline } from './module/module.ar';
export { ModuleAr, ModuleArDef } from './module/module.ar';
export { ModulePolicy } from './module/module.policy';
export type { ModuleState } from './module/module.state';
export { LegacyModulePolicy } from './module/policy';
export type { LegacyModuleRepo, ModuleListFilter } from './module/repo';
export type { ModuleId as ModuleEntityId } from './module/types';
// DQS снимка контента модуля
export { ModuleSnapshotDqs } from './module-snapshot.dqs';
// Общие типы
export { Status, StatusSchema } from './status';
// Агрегат Step: новый и legacy (`Legacy*`) — legacy живёт рядом
export { LegacyStepAr } from './step/a-root';
export type {
  CreateStepCmd,
  CreateStepCmdError,
  CreateStepCmdMeta,
} from './step/commands/create-step-cmd';
export { CreateStepCmdSchema } from './step/commands/create-step-cmd';
export type {
  StepAccessDeniedUcError,
  StepModuleError,
  StepNotFoundUcError,
} from './step/commands/errors';
export type {
  GetStepCmd,
  GetStepCmdError,
  GetStepCmdMeta,
} from './step/commands/get-step-cmd';
export { GetStepCmdSchema } from './step/commands/get-step-cmd';
export type {
  GetStepsByLessonsCmd,
  GetStepsByLessonsCmdMeta,
  StepsByLesson,
} from './step/commands/get-steps-by-lessons-cmd';
export { GetStepsByLessonsCmdSchema } from './step/commands/get-steps-by-lessons-cmd';
export type {
  Step,
  StepArMeta,
  StepCode,
  StepFile,
  StepText,
} from './step/entity';
export { StepCommonSchema, StepSchema } from './step/entity';
export { LegacyStepPolicy } from './step/policy';
export type { LegacyStepRepo } from './step/repo';
export type { StepSummary, StepView } from './step/step.ar';
export { StepAr, StepArDef } from './step/step.ar';
export { StepErrors } from './step/step.errors';
export type { FileVo, StepState } from './step/step.state';
export type {
  CourseId,
  LessonId,
  ModuleId,
  StepId,
} from './types';
