import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { defineErrors } from '#core/kernel/errors/define-errors';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import { expectErr, expectOk } from '#core/testing/index';
import { defineEvents } from '../events/define-events';
import {
  Aggregate,
  type ErrorsOf,
  type EventsOf,
  newEntity,
  type StateOf,
} from './aggregate';
import { defineAggregate } from './define-aggregate';

const TaskState = v.object({
  ...BaseEntityFields,
  title: F.string('Название'),
  status: F.picklist(['open', 'done'], 'Статус'),
});

const TaskEvents = defineEvents('todo.task', {
  created: {
    label: 'Задача создана',
    description: 'Появилась новая задача.',
    payload: v.object({ taskId: v.string() }),
  },
  completed: {
    label: 'Задача выполнена',
    description: 'Задача отмечена выполненной.',
    payload: v.object({ taskId: v.string() }),
  },
});

const TaskErrors = defineErrors('TASK', {
  ALREADY_DONE: {
    kind: 'conflict',
    label: 'Задача уже выполнена',
    description: 'Повторно завершить задачу нельзя.',
  },
  TITLE_RESERVED: {
    kind: 'conflict',
    label: 'Название занято',
    description: 'Это название зарезервировано.',
  },
});

const TaskArDef = defineAggregate({
  name: 'task',
  label: 'Задача',
  description: 'Пункт списка дел.',
  state: TaskState,
  statuses: { open: { label: 'Открыта' }, done: { label: 'Выполнена' } },
  transitions: {
    complete: {
      from: ['open'],
      to: 'done',
      rejects: { done: TaskErrors.ALREADY_DONE },
    },
  },
  events: TaskEvents,
  errors: TaskErrors,
});

type TaskError = ErrorsOf<typeof TaskArDef>;

class TaskAr extends Aggregate<typeof TaskArDef> {
  private constructor(
    state: StateOf<typeof TaskArDef>,
    events?: readonly EventsOf<typeof TaskArDef>[],
  ) {
    super(TaskArDef, state, events);
  }

  static create(
    uuid: string,
    title: string,
    at: Timestamp,
  ): Result<TaskAr, TaskError> {
    const created = TaskEvents.created.make({ taskId: uuid });
    const state = { ...newEntity(uuid, at), title, status: 'open' as const };
    return ok(new TaskAr(state, [created]));
  }

  static restore(snapshot: StateOf<typeof TaskArDef>): TaskAr {
    return new TaskAr(snapshot);
  }

  complete(at: Timestamp): Result<void, TaskError> {
    return this.transition('complete', at, (draft, emit) => {
      emit(TaskEvents.completed.make({ taskId: draft.uuid }));
      return ok();
    });
  }

  // Переход, который пытается сам выставить другой статус.
  completeWrongly(at: Timestamp): Result<void, TaskError> {
    return this.transition('complete', at, (draft) => {
      draft.status = 'open';
      return ok();
    });
  }

  // Меняет черновик до проверки — чтобы показать откат при Err.
  rename(title: string, at: Timestamp): Result<void, TaskError> {
    return this.change(at, (draft, emit) => {
      draft.title = title;
      emit(TaskEvents.completed.make({ taskId: draft.uuid }));
      if (title === 'резерв') return TaskErrors.TITLE_RESERVED.err();
      return ok();
    });
  }

  // Статус меняется мимо transition.
  reopen(at: Timestamp): Result<void, TaskError> {
    return this.change(at, (draft) => {
      draft.status = 'open';
      return ok();
    });
  }

  isDone(): boolean {
    return this.state.status === 'done';
  }
}

const ID = '7b0c1f5e-4a5b-4c8e-9a51-2f6d3e8b9c10';
const T0 = Date.UTC(2026, 0, 1);
const T1 = Date.UTC(2026, 0, 2);

const stored = (status: 'open' | 'done') => ({
  uuid: ID,
  createdAt: T0,
  updatedAt: T0,
  version: 3,
  title: 'Купить хлеб',
  status,
});

describe('defineAggregate', () => {
  it('Def несёт метаданные, статусы, переходы и ссылки на группы', () => {
    expect(TaskArDef.dmg).toBe('aggregate');
    expect(TaskArDef.name).toBe('task');
    expect(TaskArDef.label).toBe('Задача');
    expect(TaskArDef.statuses.done.label).toBe('Выполнена');
    expect(TaskArDef.transitions.complete).toEqual({
      from: ['open'],
      to: 'done',
      rejects: { done: TaskErrors.ALREADY_DONE },
    });
    expect(TaskArDef.events).toBe(TaskEvents);
    expect(TaskArDef.errors).toBe(TaskErrors);
  });

  it('статусы обязаны покрыть все значения `status` состояния', () => {
    defineAggregate({
      name: 'task',
      label: 'Задача',
      description: 'Пункт списка дел.',
      state: TaskState,
      // @ts-expect-error нет статуса `done`
      statuses: { open: { label: 'Открыта' } },
      transitions: {},
      events: TaskEvents,
      errors: TaskErrors,
    });
    expect(true).toBe(true);
  });

  it('переход объявляет отказ для каждого статуса вне `from`', () => {
    defineAggregate({
      name: 'task',
      label: 'Задача',
      description: 'Пункт списка дел.',
      state: TaskState,
      statuses: { open: { label: 'Открыта' }, done: { label: 'Выполнена' } },
      transitions: {
        // @ts-expect-error нет отказа для статуса `done`
        complete: { from: ['open'], to: 'done', rejects: {} },
      },
      events: TaskEvents,
      errors: TaskErrors,
    });
    expect(true).toBe(true);
  });
});

describe('Aggregate', () => {
  describe('create', () => {
    it('создаёт агрегат и накапливает событие создания', () => {
      const ar = expectOk(TaskAr.create(ID, 'Купить хлеб', T0));
      expect(ar.uuid).toBe(ID);
      expect(ar.pullEvents()).toEqual([
        { name: 'todo.task.created', payload: { taskId: ID } },
      ]);
    });

    it('pullEvents() выдаёт события один раз', () => {
      const ar = expectOk(TaskAr.create(ID, 'Купить хлеб', T0));
      ar.pullEvents();
      expect(ar.pullEvents()).toEqual([]);
    });
  });

  describe('restore', () => {
    it('восстанавливает без событий', () => {
      const ar = TaskAr.restore(stored('open'));
      expect(ar.snapshot()).toEqual(stored('open'));
      expect(ar.pullEvents()).toEqual([]);
    });

    it('невалидный снимок — исключение (данные повреждены)', () => {
      expect(() => TaskAr.restore({ ...stored('open'), title: '' })).toThrow(
        'task',
      );
    });
  });

  it('snapshot() — копия, не ссылка на состояние', () => {
    const ar = TaskAr.restore(stored('open'));
    const copy = ar.snapshot();
    copy.status = 'done';
    expect(ar.isDone()).toBe(false);
  });

  describe('change', () => {
    it('Ok фиксирует черновик, ставит updatedAt моментом операции и накапливает событие', () => {
      const ar = TaskAr.restore(stored('open'));
      expectOk(ar.complete(T1));
      expect(ar.snapshot()).toEqual({
        ...stored('done'),
        updatedAt: T1,
        version: 4,
      });
      expect(ar.pullEvents()).toEqual([
        { name: 'todo.task.completed', payload: { taskId: ID } },
      ]);
    });

    it('Err не меняет состояние', () => {
      const ar = TaskAr.restore(stored('done'));
      expectErr(ar.complete(T1), 'TASK_ALREADY_DONE');
      expect(ar.snapshot()).toEqual(stored('done'));
    });

    it('Err отбрасывает изменённый черновик и его события', () => {
      const ar = TaskAr.restore(stored('open'));
      expectErr(ar.rename('резерв', T1), 'TASK_TITLE_RESERVED');
      expect(ar.snapshot()).toEqual(stored('open'));
      expect(ar.pullEvents()).toEqual([]);
    });

    it('невалидный черновик — исключение, состояние и события прежние', () => {
      const ar = TaskAr.restore(stored('open'));
      expect(() => ar.rename('', T1)).toThrow('task');
      expect(ar.snapshot()).toEqual(stored('open'));
      expect(ar.pullEvents()).toEqual([]);
    });

    it('смена статуса через change — исключение: статус меняет только transition', () => {
      const ar = TaskAr.restore(stored('done'));
      expect(() => ar.reopen(T1)).toThrow('transition');
      expect(ar.isDone()).toBe(true);
    });
  });

  describe('transition', () => {
    it('статус вне `from` — объявленный в Def отказ, состояние прежнее', () => {
      const ar = TaskAr.restore(stored('done'));
      expectErr(ar.complete(T1), 'TASK_ALREADY_DONE');
      expect(ar.snapshot()).toEqual(stored('done'));
      expect(ar.pullEvents()).toEqual([]);
    });

    it('статус `to` ставит база; apply не меняет его', () => {
      const ar = TaskAr.restore(stored('open'));
      expect(() => ar.completeWrongly(T1)).toThrow('done');
      expect(ar.isDone()).toBe(false);
    });
  });

  describe('версия (оптимистичная блокировка)', () => {
    it('новый агрегат — версия 0, ещё не сохранён', () => {
      const ar = expectOk(TaskAr.create(ID, 'Купить хлеб', T0));
      expect(ar.version).toBe(0);
      expect(ar.storedVersion).toBe(0);
    });

    it('снимок без версии (данные до D-36) читается как версия 0', () => {
      const { version: _, ...legacy } = stored('open');
      expect(TaskAr.restore(legacy as never).version).toBe(0);
    });

    it('каждая мутация увеличивает версию; сохранённая — версия при загрузке', () => {
      const ar = TaskAr.restore(stored('open'));
      expectOk(ar.rename('Купить молоко', T1));
      expectOk(ar.complete(T1));
      expect(ar.version).toBe(5);
      expect(ar.storedVersion).toBe(3);
    });

    it('Err версию не меняет', () => {
      const ar = TaskAr.restore(stored('done'));
      expectErr(ar.complete(T1), 'TASK_ALREADY_DONE');
      expect(ar.version).toBe(3);
    });

    it('markStored — после записи сохранённой считается текущая версия', () => {
      const ar = TaskAr.restore(stored('open'));
      expectOk(ar.complete(T1));
      ar.markStored();
      expect(ar.storedVersion).toBe(4);
    });
  });
});
