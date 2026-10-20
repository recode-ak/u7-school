import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { defineRules } from '#core/domain/rules/define-rules';
import { domainRule } from '#core/domain/rules/domain-rule';
import { ok } from '#core/kernel/result/result';
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
const withinOpenLimit = domainRule({
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

export const TaskRules = defineRules({
  name: 'task',
  label: 'Правила задач',
  description: 'Допустимость действий с задачами при их текущих состояниях.',
  rules: { withinOpenLimit },
});
