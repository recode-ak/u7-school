import * as v from 'valibot';
import { BaseEntityFields, F } from '../../../../kernel/fields/fields';

/** Entity задачи — единственное место структуры состояния. */
export const TaskState = v.object({
  ...BaseEntityFields,
  ownerId: F.uuid('владельца'),
  title: F.string('Название задачи'),
  status: F.picklist(['open', 'done', 'archived'], 'Статус задачи'),
  completedAt: v.optional(F.timestamp('выполнения')),
});

export type TaskState = v.InferOutput<typeof TaskState>;
