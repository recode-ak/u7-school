import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import { TaskArDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskEvents } from '../task.events';
import { TaskRules } from '../task.rules';
import { TaskState } from '../task.state';

export const CreateTaskUcDef = defineUseCase({
  name: 'createTask',
  label: 'Создать задачу',
  description: 'Добавляет открытую задачу в список вызывающего.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: allowAll,
  rules: [TaskRules.rules.withinOpenLimit],
  input: v.object({ title: TaskState.entries.title }),
  output: v.object({ taskId: TaskState.entries.uuid }),
  errors: [TaskErrors.TOO_MANY_OPEN],
  emits: [TaskEvents.created],
});
