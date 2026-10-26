import { defineModule } from '#core/domain/contracts/define-module';
import { UsersModuleDef } from '#core/testing/example/users/contract';
import { ReleaseRemovedUserTasksErDef } from './task/er/release-removed-user-tasks.er';
import { ArchiveDoneTasksJobDef } from './task/job/archive-done-tasks.job';
import { TaskArDef } from './task/task.ar';
import { AssignTaskUcDef } from './task/uc/assign-task.uc';
import { CompleteTaskUcDef } from './task/uc/complete-task.uc';
import { CreateTaskUcDef } from './task/uc/create-task.uc';
import { GetTaskUcDef } from './task/uc/get-task.uc';
import { ListTasksUcDef } from './task/uc/list-tasks.uc';

/** Паспорт модуля todo; зависимость — из контракта `users` (ARC-04, D-45). */
export const TodoModuleDef = defineModule({
  name: 'todo',
  label: 'Задачи',
  description: 'Учебный модуль DMG: личный список дел. Эталон для тестов core.',
  dependsOn: [UsersModuleDef],
  aggregates: [TaskArDef],
  useCases: [
    CreateTaskUcDef,
    CompleteTaskUcDef,
    ListTasksUcDef,
    GetTaskUcDef,
    AssignTaskUcDef,
  ],
  reactions: [ReleaseRemovedUserTasksErDef],
  jobs: [ArchiveDoneTasksJobDef],
});
