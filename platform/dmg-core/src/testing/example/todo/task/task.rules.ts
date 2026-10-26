import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { DomainRuleDef } from '#core/domain/rules/domain-rule-def';
import { RulesDef } from '#core/domain/rules/rules-def';
import { ok } from '#core/kernel/result/result';
import type { UserActivity } from '#core/testing/example/users/contract';
import type { TaskAr } from './task.ar';
import { TaskErrors } from './task.errors';

/** Предел открытых задач одного владельца. */
export const OPEN_TASKS_LIMIT = 3;

/** Контекст правила: неархивные задачи владельца новой задачи. */
export type OwnerTasksCtx = {
  readonly ownerTasks: readonly ReadonlyAr<TaskAr>[];
};

/**
 * Доменное правило без субъекта (D-40): ответ зависит только от задач
 * владельца, а не от того, кто спрашивает. Статус задачи решает Ar (D-39).
 */
const withinOpenLimit = DomainRuleDef.define({
  name: 'withinOpenLimit',
  label: 'Открытых задач меньше предела',
  description: `Новая задача создаётся, только если у владельца меньше ${OPEN_TASKS_LIMIT} открытых задач.`,
  error: TaskErrors.TOO_MANY_OPEN,
  check: (ctx: OwnerTasksCtx) => {
    const open = ctx.ownerTasks.filter((t) => t.isOpen()).length;
    return open < OPEN_TASKS_LIMIT
      ? ok()
      : TaskErrors.TOO_MANY_OPEN.err({ limit: OPEN_TASKS_LIMIT });
  },
});

/**
 * Контекст назначения: ответ модуля `users` об исполнителе (UC `getUser`,
 * D-42) — делегирование минимумом, без state чужого агрегата.
 */
export type AssigneeCtx = { readonly assignee: UserActivity };

/**
 * Правило над ответом чужого модуля (D-40): активна ли учётная запись,
 * решает `users`; здесь — перевод его ответа в ошибку задач. Нет
 * пользователя вовсе — отказ самого вызова (`USER_NOT_FOUND`, ERR-03), до
 * правила дело не доходит.
 */
const assigneeActive = DomainRuleDef.define({
  name: 'assigneeActive',
  label: 'Исполнитель активен',
  description:
    'Задачу назначают только пользователю с активной учётной записью.',
  error: TaskErrors.ASSIGNEE_INACTIVE,
  check: ({ assignee }: AssigneeCtx) =>
    assignee.active
      ? ok()
      : TaskErrors.ASSIGNEE_INACTIVE.err({ assigneeId: assignee.userId }),
});

export const TaskRules = RulesDef.define({
  name: 'task',
  label: 'Правила задач',
  description:
    'Допустимость действий с задачами при их текущих состояниях и ответах зависимостей.',
  rules: { withinOpenLimit, assigneeActive },
});
