import { Aggregate } from '#core/domain/aggregate/aggregate';
import type {
  ErrorsOf,
  EventsOf,
  RejectOf,
} from '#core/domain/aggregate/aggregate.types';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
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
    complete: {
      from: ['open'],
      to: 'done',
      rejects: { done: TaskErrors.ALREADY_DONE, archived: TaskErrors.ARCHIVED },
    },
    archive: {
      from: ['open', 'done'],
      to: 'archived',
      rejects: { archived: TaskErrors.ARCHIVED },
    },
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

  static create(input: CreateTask, at: Timestamp): Result<TaskAr, never> {
    const created = TaskEvents.created.make({
      taskId: input.uuid,
      ownerId: input.ownerId,
      title: input.title,
    });
    const state: TaskState = {
      ...TaskAr.newState(input.uuid, at),
      ownerId: input.ownerId,
      title: input.title,
      status: 'open',
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

  isOpen(): boolean {
    return this.state.status === 'open';
  }

  isDone(): boolean {
    return this.state.status === 'done';
  }

  isArchived(): boolean {
    return this.state.status === 'archived';
  }

  // Отказы — только ошибки `rejects` перехода, а не вся группа: UC объявляет
  // в `errors` то, что реально может вернуть (ERR-02).
  complete(
    at: Timestamp,
  ): Result<void, RejectOf<typeof TaskArDef, 'complete'>> {
    return this.transition('complete', at, (draft, emit) => {
      draft.completedAt = at;
      emit(TaskEvents.completed.make(this.ref()));
      return ok();
    });
  }

  archive(at: Timestamp): Result<void, RejectOf<typeof TaskArDef, 'archive'>> {
    return this.transition('archive', at, (_, emit) => {
      emit(TaskEvents.archived.make(this.ref()));
      return ok();
    });
  }

  private ref() {
    return { taskId: this.uuid, ownerId: this.ownerId };
  }
}
