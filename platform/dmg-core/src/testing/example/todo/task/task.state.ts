import * as v from 'valibot';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';

/**
 * Назначение задачи исполнителю — VO только этого агрегата, поэтому лежит
 * рядом с entity. Исполнитель — пользователь модуля `users`, проверенный
 * при назначении (UC `assignTask`).
 */
export const TaskAssignmentVo = v.pipe(
  v.object({
    assigneeId: F.uuid('исполнителя'),
    assignedAt: F.timestamp('назначения'),
  }),
  v.description('Назначение задачи исполнителю'),
);

export type TaskAssignmentVo = v.InferOutput<typeof TaskAssignmentVo>;

/**
 * Статус задачи:
 * - `open` — открыта, её можно выполнить и назначить;
 * - `done` — выполнена;
 * - `archived` — в архиве, больше не меняется.
 */
export const TaskStatus = F.picklist(
  ['open', 'done', 'archived'],
  'Статус задачи',
);

export type TaskStatus = v.InferOutput<typeof TaskStatus>;

/** Entity задачи — единственное место структуры состояния. */
export const TaskState = v.object({
  ...BaseEntityFields,
  ownerId: F.uuid('владельца'),
  title: F.string('Название задачи'),
  status: TaskStatus,
  completedAt: v.optional(F.timestamp('выполнения')),
  assignment: v.optional(TaskAssignmentVo),
});

export type TaskState = v.InferOutput<typeof TaskState>;
