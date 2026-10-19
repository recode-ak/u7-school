import * as v from 'valibot';
import { defineUseCase } from '../../../../../domain/contracts/define-use-case';
import { TaskDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskEvents } from '../task.events';
import { TaskPolicy } from '../task.policy';
import { TaskState } from '../task.state';

export const CompleteTaskUc = defineUseCase({
  name: 'completeTask',
  label: 'Выполнить задачу',
  description: 'Отмечает открытую задачу выполненной.',
  type: 'command',
  aggregate: TaskDef,
  callers: ['user', 'delegate'],
  policy: TaskPolicy.rules.canManage,
  input: v.object({ taskId: TaskState.entries.uuid }),
  output: v.object({}),
  errors: [TaskErrors.NOT_FOUND, TaskErrors.ALREADY_DONE, TaskErrors.ARCHIVED],
  emits: [TaskEvents.completed],
});
