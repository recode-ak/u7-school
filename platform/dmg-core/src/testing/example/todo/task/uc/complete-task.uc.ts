import * as v from 'valibot';
import { UseCaseDef } from '#core/domain/contracts/use-case-def';
import { TaskArDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskEvents } from '../task.events';
import { TaskPolicy } from '../task.policy';
import { TaskState } from '../task.state';

export const CompleteTaskUcDef = UseCaseDef.define({
  name: 'completeTask',
  label: 'Выполнить задачу',
  description: 'Отмечает открытую задачу выполненной.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: TaskPolicy.rules.canManage,
  input: v.object({ taskId: TaskState.entries.uuid }),
  output: v.object({}),
  errors: [TaskErrors.NOT_FOUND, TaskErrors.ALREADY_DONE, TaskErrors.ARCHIVED],
  emits: [TaskEvents.completed],
});
