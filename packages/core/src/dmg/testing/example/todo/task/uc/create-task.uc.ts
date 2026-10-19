import * as v from 'valibot';
import { defineUseCase } from '../../../../../domain/contracts/define-use-case';
import { allowAll } from '../../../../../domain/policy/policy';
import { TaskDef } from '../task.ar';
import { TaskEvents } from '../task.events';
import { TaskState } from '../task.state';

export const CreateTaskUc = defineUseCase({
  name: 'createTask',
  label: 'Создать задачу',
  description: 'Добавляет открытую задачу в список вызывающего.',
  type: 'command',
  aggregate: TaskDef,
  callers: ['user', 'delegate'],
  policy: allowAll,
  input: v.object({ title: TaskState.entries.title }),
  output: v.object({ taskId: TaskState.entries.uuid }),
  errors: [],
  emits: [TaskEvents.created],
});
