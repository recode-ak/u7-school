import { defineModule } from '../../../domain/contracts/define-module';
import { UsersModule } from '../users/users.module';
import { ArchiveRemovedUserTasksEr } from './task/er/archive-removed-user-tasks.er';
import { ArchiveDoneTasksJob } from './task/job/archive-done-tasks.job';
import { TaskDef } from './task/task.ar';
import { CompleteTaskUc } from './task/uc/complete-task.uc';
import { CreateTaskUc } from './task/uc/create-task.uc';
import { ListTasksUc } from './task/uc/list-tasks.uc';
import { TodoFacade } from './todo.facade';

export const TodoModule = defineModule({
  name: 'todo',
  label: 'Задачи',
  description: 'Учебный модуль DMG: личный список дел. Эталон для тестов core.',
  dependsOn: [UsersModule],
  aggregates: [TaskDef],
  useCases: [CreateTaskUc, CompleteTaskUc, ListTasksUc],
  reactions: [ArchiveRemovedUserTasksEr],
  jobs: [ArchiveDoneTasksJob],
  facade: TodoFacade,
});
