import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import { TaskArDef } from '../task.ar';
import { TaskState } from '../task.state';

export const ListTasksUcDef = defineUseCase({
  name: 'listTasks',
  label: 'Мои задачи',
  description: 'Неархивные задачи вызывающего: открытые и выполненные.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: allowAll,
  input: v.object({}),
  output: v.array(v.pick(TaskState, ['uuid', 'title', 'status'])),
  errors: [],
});
