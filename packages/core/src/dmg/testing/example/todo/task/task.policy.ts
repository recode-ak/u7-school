import type { ReadonlyAr } from '#dmg/domain/aggregate/readonly-ar';
import { definePolicy } from '#dmg/domain/policy/define-policy';
import { anyOf, hasRole, rule } from '#dmg/domain/policy/policy';
import type { TaskAr } from './task.ar';

/** Контекст правил задачи: задача, над которой действие. */
export type TaskCtx = { readonly task: ReadonlyAr<TaskAr> };

const isOwner = rule({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачей управляет только её владелец.',
  check: (subject: { readonly uuid: string }, ctx: TaskCtx) =>
    ctx.task.isOwnedBy(subject.uuid),
});

export const TaskPolicy = definePolicy({
  name: 'task',
  label: 'Права на задачи',
  description: 'Кто может управлять задачей: владелец или администратор.',
  rules: {
    canManage: anyOf(
      {
        name: 'canManage',
        label: 'Владелец или администратор',
        denyMessage: 'Управлять задачей может владелец или администратор.',
      },
      isOwner,
      hasRole('admin'),
    ),
  },
});
