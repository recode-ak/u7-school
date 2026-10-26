import { Aggregate } from '#core/domain/aggregate/aggregate';
import type {
  ErrorsOf,
  EventsOf,
  RejectOf,
} from '#core/domain/aggregate/aggregate.types';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import type { ErrorOf } from '#core/kernel/errors/error-def';
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

  isAssignedTo(userId: string): boolean {
    return this.state.assignment?.assigneeId === userId;
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

  /**
   * Назначает исполнителя открытой задаче. Статус не меняется — мутация
   * через `change`, события всё равно порождает агрегат. Тот же исполнитель
   * — `ok` без изменений (повтор ничего не пишет). Смена исполнителя —
   * одна мутация с двумя событиями: `unassigned` прежнего, затем `assigned`
   * нового, — по событиям текущий исполнитель восстанавливается всегда.
   * Активен ли исполнитель, решает правило UC над ответом `users`
   * (`TaskRules.assigneeActive`), а не Ar: у Ar нет чужих данных.
   */
  assign(
    assigneeId: string,
    at: Timestamp,
  ): Result<void, ErrorOf<typeof TaskErrors.NOT_ASSIGNABLE>> {
    if (!this.isOpen()) return TaskErrors.NOT_ASSIGNABLE.err();
    if (this.isAssignedTo(assigneeId)) return ok();
    const previous = this.state.assignment;
    return this.change(at, (draft, emit) => {
      if (previous !== undefined) {
        emit(
          TaskEvents.unassigned.make({
            ...this.ref(),
            assigneeId: previous.assigneeId,
          }),
        );
      }
      draft.assignment = { assigneeId, assignedAt: at };
      emit(TaskEvents.assigned.make({ ...this.ref(), assigneeId }));
      return ok();
    });
  }

  /**
   * Снимает исполнителя: задача возвращается владельцу. Без назначения —
   * `ok` без изменений (повторное событие ничего не пишет); архивную
   * задачу не меняем.
   */
  unassign(at: Timestamp): Result<void, ErrorOf<typeof TaskErrors.ARCHIVED>> {
    if (this.isArchived()) return TaskErrors.ARCHIVED.err();
    const { assignment } = this.state;
    if (assignment === undefined) return ok();
    return this.change(at, (draft, emit) => {
      delete draft.assignment;
      emit(
        TaskEvents.unassigned.make({
          ...this.ref(),
          assigneeId: assignment.assigneeId,
        }),
      );
      return ok();
    });
  }

  private ref() {
    return { taskId: this.uuid, ownerId: this.ownerId };
  }
}
