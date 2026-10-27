import * as v from 'valibot';
import { UseCaseDef } from '#core/domain/contracts/use-case-def';
import { allowAll } from '#core/domain/policy/rule';
import { TaskArDef } from '../task.ar';
import { TaskState } from '../task.state';

export const ListTasksUcDef = UseCaseDef.define({
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
