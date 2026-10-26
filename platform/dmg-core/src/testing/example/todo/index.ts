// Публичный API учебного модуля todo для своего прикладного слоя
// (`example/app/todo`): контракт, state, Ar, Policy, правила, DCS и Def
// реакций и задач. Другие модули импортируют только `contract.ts`.
export * from './contract';
export * from './state';
export { ReleaseRemovedUserTasksErDef } from './task/er/release-removed-user-tasks.er';
export { ArchiveDoneTasksJobDef } from './task/job/archive-done-tasks.job';
export {
  type CreateTask,
  TaskAr,
  TaskArDef,
  type TaskError,
} from './task/task.ar';
export { type TaskCtx, TaskPolicy } from './task/task.policy';
export {
  type AssigneeCtx,
  OPEN_TASKS_LIMIT,
  type OwnerTasksCtx,
  TaskRules,
} from './task/task.rules';
export { TaskReleaseDcs } from './task-release.dcs';
export type { TaskRelease } from './task-release.types';
