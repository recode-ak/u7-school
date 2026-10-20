import { defineModule } from '#dmg/domain/contracts/define-module';
import { UsersModuleDef } from '../users';
import { ArchiveRemovedUserTasksErDef } from './task/er/archive-removed-user-tasks.er';
import { ArchiveDoneTasksJobDef } from './task/job/archive-done-tasks.job';
import { TaskArDef } from './task/task.ar';
import { CompleteTaskUcDef } from './task/uc/complete-task.uc';
import { CreateTaskUcDef } from './task/uc/create-task.uc';
import { ListTasksUcDef } from './task/uc/list-tasks.uc';
import { TodoFacadeDef } from './todo.facade';

export const TodoModuleDef = defineModule({
  name: 'todo',
  label: 'Задачи',
  description: 'Учебный модуль DMG: личный список дел. Эталон для тестов core.',
  dependsOn: [UsersModuleDef],
  aggregates: [TaskArDef],
  useCases: [CreateTaskUcDef, CompleteTaskUcDef, ListTasksUcDef],
  reactions: [ArchiveRemovedUserTasksErDef],
  jobs: [ArchiveDoneTasksJobDef],
  facade: TodoFacadeDef,
});
