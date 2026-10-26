import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { GetUserUcDef, UserErrors } from '#core/testing/example/users/contract';
import { TaskArDef } from '../task.ar';
import { TaskErrors } from '../task.errors';
import { TaskEvents } from '../task.events';
import { TaskPolicy } from '../task.policy';
import { TaskRules } from '../task.rules';
import { TaskAssignmentVo, TaskState } from '../task.state';

/**
 * Назначение исполнителя — command с вызовом чужого модуля: `load`
 * спрашивает `users` (`this.call(GetUserUcDef, …)`) и кладёт ответ в
 * контекст, решение — правило `assigneeActive` над ответом, а не `if` в UC
 * (API-01). Порядок отказов: нет задачи → нет пользователя (ошибка `users`
 * по ссылке, ERR-03) → Policy → исполнитель неактивен → задача не открыта.
 * Смена исполнителя публикует `unassigned` прежнего, затем `assigned`.
 */
export const AssignTaskUcDef = defineUseCase({
  name: 'assignTask',
  label: 'Назначить задачу',
  description:
    'Назначает открытой задаче исполнителя — активного пользователя.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: TaskPolicy.rules.canManage,
  rules: [TaskRules.rules.assigneeActive],
  calls: [GetUserUcDef],
  input: v.object({
    taskId: TaskState.entries.uuid,
    assigneeId: TaskAssignmentVo.entries.assigneeId,
  }),
  output: v.object({}),
  errors: [
    TaskErrors.NOT_FOUND,
    UserErrors.NOT_FOUND,
    TaskErrors.ASSIGNEE_INACTIVE,
    TaskErrors.NOT_ASSIGNABLE,
  ],
  emits: [TaskEvents.unassigned, TaskEvents.assigned],
});
