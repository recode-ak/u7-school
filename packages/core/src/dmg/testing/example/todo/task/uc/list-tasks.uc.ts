import * as v from 'valibot';
import { defineUseCase } from '../../../../../domain/contracts/define-use-case';
import { allowAll } from '../../../../../domain/policy/policy';
import { TaskDef } from '../task.ar';
import { TaskState } from '../task.state';

export const ListTasksUc = defineUseCase({
  name: 'listTasks',
  label: 'Мои задачи',
  description: 'Неархивные задачи вызывающего: открытые и выполненные.',
  type: 'query',
  aggregate: TaskDef,
  callers: ['user', 'delegate'],
  policy: allowAll,
  input: v.object({}),
  output: v.array(v.pick(TaskState, ['uuid', 'title', 'status'])),
  errors: [],
});
