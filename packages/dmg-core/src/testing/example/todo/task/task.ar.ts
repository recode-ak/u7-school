import {
  Aggregate,
  type ErrorsOf,
  type EventsOf,
} from '#core/domain/aggregate/aggregate';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { ok, type Result } from '#core/kernel/result/result';
import { now } from '#core/kernel/time/now';
import { TaskErrors } from './task.errors';
import { TaskEvents } from './task.events';
import { TaskState } from './task.state';

export const TaskArDef = defineAggregate({
  name: 'task',
  label: 'Задача',
  description:
    'Пункт личного списка дел: создаётся открытым, выполняется, уходит в архив.',
  state: TaskState,
  statuses: {
    open: { label: 'Открыта' },
    done: { label: 'Выполнена' },
    archived: { label: 'В архиве' },
  },
  transitions: {
    complete: { from: ['open'], to: 'done' },
    archive: { from: ['open', 'done'], to: 'archived' },
  },
  events: TaskEvents,
  errors: TaskErrors,
});

export type TaskError = ErrorsOf<typeof TaskArDef>;
type TaskEvent = EventsOf<typeof TaskArDef>;

export type CreateTask = {
  readonly uuid: string;
  readonly ownerId: string;
  readonly title: string;
};

export class TaskAr extends Aggregate<typeof TaskArDef> {
  private constructor(state: TaskState, events?: readonly TaskEvent[]) {
    super(TaskArDef, state, events);
  }

  static create(input: CreateTask): Result<TaskAr, never> {
    const at = now();
    const created = TaskEvents.created.make({
      taskId: input.uuid,
      ownerId: input.ownerId,
      title: input.title,
    });
    const state: TaskState = {
      ...input,
      status: 'open',
      createdAt: at,
      updatedAt: at,
    };
    return ok(new TaskAr(state, [created]));
  }

  static restore(snapshot: TaskState): TaskAr {
    return new TaskAr(snapshot);
  }

  get ownerId(): string {
    return this.state.ownerId;
  }

  isOwnedBy(userId: string): boolean {
    return this.state.ownerId === userId;
  }

  isDone(): boolean {
    return this.state.status === 'done';
  }

  isArchived(): boolean {
    return this.state.status === 'archived';
  }

  complete(): Result<void, TaskError> {
    return this.change((draft, emit) => {
      if (draft.status === 'archived') return TaskErrors.ARCHIVED.err();
      if (draft.status === 'done') return TaskErrors.ALREADY_DONE.err();
      draft.status = 'done';
      draft.completedAt = now();
      emit(TaskEvents.completed.make(this.ref()));
      return ok();
    });
  }

  archive(): Result<void, TaskError> {
    return this.change((draft, emit) => {
      if (draft.status === 'archived') return TaskErrors.ARCHIVED.err();
      draft.status = 'archived';
      emit(TaskEvents.archived.make(this.ref()));
      return ok();
    });
  }

  private ref() {
    return { taskId: this.uuid, ownerId: this.ownerId };
  }
}
