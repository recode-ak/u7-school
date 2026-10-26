import { defineEventReaction } from '#core/domain/contracts/define-event-reaction';
import { UserEvents } from '#core/testing/example/users/contract';
import { TaskArDef } from '../task.ar';
import { TaskEvents } from '../task.events';

/**
 * Реакция на событие внешнего модуля (`on` — Def из контракта `users`).
 * Что делать с задачами, решает DCS `TaskReleaseDcs`: батч по нескольким
 * задачам, ER только загружает, отдаёт домену и регистрирует изменённые.
 */
export const ReleaseRemovedUserTasksErDef = defineEventReaction({
  name: 'releaseRemovedUserTasks',
  label: 'Освободить задачи удалённого пользователя',
  description:
    'Когда пользователь удалён, его задачи уходят в архив, а назначенные ему чужие задачи возвращаются владельцам.',
  on: [UserEvents.removed],
  touches: [TaskArDef],
  emits: [TaskEvents.archived, TaskEvents.unassigned],
});
