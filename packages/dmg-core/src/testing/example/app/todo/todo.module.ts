import type { ModuleDeps } from '#core/app/context';
import {
  ModuleFromDef,
  type ModuleMap,
} from '#core/app/module/module-from-def';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import type { ExampleUser } from '../app-user';
import { ArchiveRemovedUserTasksEr } from './task/er/archive-removed-user-tasks.er';
import { ArchiveDoneTasksJob } from './task/job/archive-done-tasks.job';
import type { TaskRepo } from './task/task.repo';
import { CompleteTaskUc } from './task/uc/complete-task.uc';
import { CreateTaskUc } from './task/uc/create-task.uc';
import { GetTaskUc } from './task/uc/get-task.uc';
import { ListTasksUc } from './task/uc/list-tasks.uc';

/** Резолвер модуля: платформа + репозитории. */
export type TodoDeps = ModuleDeps & { readonly tasks: TaskRepo };

/** Карта «Def → класс» модуля todo (API-05). */
export const todoMap = {
  useCases: {
    createTask: CreateTaskUc,
    completeTask: CompleteTaskUc,
    listTasks: ListTasksUc,
    getTask: GetTaskUc,
  },
  reactions: { archiveRemovedUserTasks: ArchiveRemovedUserTasksEr },
  jobs: { archiveDoneTasks: ArchiveDoneTasksJob },
} satisfies ModuleMap<typeof TodoModuleDef, TodoDeps, ExampleUser>;

/** Модуль todo с зависимостями — для `ApiApp.addDmgModules`. */
export function createTodoModule(deps: TodoDeps) {
  return new ModuleFromDef<typeof TodoModuleDef, TodoDeps, ExampleUser>(
    TodoModuleDef,
    todoMap,
    deps,
  );
}
