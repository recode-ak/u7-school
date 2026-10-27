import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { PolicyDef } from '#core/domain/policy/policy-def';
import { Rule } from '#core/domain/policy/rule';
import type { TaskAr } from './task.ar';

/** Контекст правил задачи: задача, над которой действие. */
export type TaskCtx = { readonly task: ReadonlyAr<TaskAr> };

const isOwner = Rule.of({
  name: 'isOwner',
  label: 'Владелец задачи',
  denyMessage: 'Задачей управляет только её владелец.',
  check: (subject: { readonly uuid: string }, ctx: TaskCtx) =>
    ctx.task.isOwnedBy(subject.uuid),
});

export const TaskPolicy = PolicyDef.define({
  name: 'task',
  label: 'Права на задачи',
  description: 'Кто может управлять задачей: владелец или администратор.',
  rules: {
    canManage: Rule.anyOf(
      {
        name: 'canManage',
        label: 'Владелец или администратор',
        denyMessage: 'Управлять задачей может владелец или администратор.',
      },
      isOwner,
      Rule.hasRole('admin'),
    ),
  },
});
