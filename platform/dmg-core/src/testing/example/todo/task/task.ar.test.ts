import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from '#core/testing/index';
import { TaskAr } from './task.ar';
import type { TaskState } from './task.state';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);

const stored = (status: TaskState['status']): TaskState => ({
  uuid: TASK,
  ownerId: OWNER,
  title: 'Купить хлеб',
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

describe('TaskAr.create', () => {
  it('открытая задача владельца и событие created', () => {
    const ar = expectOk(
      TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Купить хлеб' }, T1),
    );
    expect(ar.snapshot()).toEqual({
      ...stored('open'),
      createdAt: T1,
      updatedAt: T1,
    });
    expect(ar.pullEvents()).toEqual([
      {
        name: 'todo.task.created',
        payload: { taskId: TASK, ownerId: OWNER, title: 'Купить хлеб' },
      },
    ]);
  });
});

describe('TaskAr.restore / snapshot', () => {
  it('round trip: снимок восстановленной задачи равен записи', () => {
    const row: TaskState = {
      ...stored('done'),
      completedAt: T1,
      assignment: { assigneeId: ASSIGNEE, assignedAt: T0 },
    };
    expect(TaskAr.restore(row).snapshot()).toEqual(row);
  });

  it('запись не по схеме — исключение (инвариант, а не отказ)', () => {
    expect(() => TaskAr.restore({ ...stored('open'), title: '' })).toThrow(
      'состояние не прошло схему',
    );
  });
});

describe('TaskAr.complete', () => {
  it('open → done, время выполнения и событие completed', () => {
    const ar = TaskAr.restore(stored('open'));
    expectOk(ar.complete(T1));
    expect(ar.isDone()).toBe(true);
    expect(ar.snapshot().completedAt).toBe(T1);
    expect(ar.pullEvents()).toEqual([
      {
        name: 'todo.task.completed',
        payload: { taskId: TASK, ownerId: OWNER },
      },
    ]);
  });

  it('выполненная — TASK_ALREADY_DONE', () => {
    const ar = TaskAr.restore(stored('done'));
    expectErr(ar.complete(T1), 'TASK_ALREADY_DONE');
    expect(ar.pullEvents()).toEqual([]);
  });

  it('архивная — TASK_ARCHIVED', () => {
    const ar = TaskAr.restore(stored('archived'));
    expectErr(ar.complete(T1), 'TASK_ARCHIVED');
    expect(ar.isArchived()).toBe(true);
  });
});

describe('TaskAr.archive', () => {
  it.each(['open', 'done'] as const)(
    '%s → archived и событие archived',
    (status) => {
      const ar = TaskAr.restore(stored(status));
      expectOk(ar.archive(T1));
      expect(ar.isArchived()).toBe(true);
      expect(ar.pullEvents()).toEqual([
        {
          name: 'todo.task.archived',
          payload: { taskId: TASK, ownerId: OWNER },
        },
      ]);
    },
  );

  it('архивная — TASK_ARCHIVED', () => {
    const ar = TaskAr.restore(stored('archived'));
    expectErr(ar.archive(T1), 'TASK_ARCHIVED');
  });
});

describe('TaskAr.assign — событие без смены статуса', () => {
  it('open: назначение, версия +1, статус прежний, событие assigned', () => {
    const ar = TaskAr.restore(stored('open'));
    expectOk(ar.assign(ASSIGNEE, T1));
    expect(ar.snapshot()).toMatchObject({
      status: 'open',
      assignment: { assigneeId: ASSIGNEE, assignedAt: T1 },
      updatedAt: T1,
      version: 1,
    });
    expect(ar.pullEvents()).toEqual([
      {
        name: 'todo.task.assigned',
        payload: { taskId: TASK, ownerId: OWNER, assigneeId: ASSIGNEE },
      },
    ]);
  });

  it.each(['done', 'archived'] as const)(
    '%s — TASK_NOT_ASSIGNABLE, без событий и изменений',
    (status) => {
      const ar = TaskAr.restore(stored(status));
      expectErr(ar.assign(ASSIGNEE, T1), 'TASK_NOT_ASSIGNABLE');
      expect(ar.pullEvents()).toEqual([]);
      expect(ar.version).toBe(0);
    },
  );

  const assignedTo = (assigneeId: string) =>
    TaskAr.restore({
      ...stored('open'),
      assignment: { assigneeId, assignedAt: T0 },
    });

  it('тот же исполнитель — ok без изменений и событий', () => {
    const ar = assignedTo(ASSIGNEE);
    expectOk(ar.assign(ASSIGNEE, T1));
    expect(ar.snapshot().assignment).toEqual({
      assigneeId: ASSIGNEE,
      assignedAt: T0,
    });
    expect(ar.version).toBe(0);
    expect(ar.pullEvents()).toEqual([]);
  });

  it('другой исполнитель — unassigned прежнего, затем assigned нового', () => {
    const ar = assignedTo(OWNER);
    expectOk(ar.assign(ASSIGNEE, T1));
    expect(ar.snapshot()).toMatchObject({
      assignment: { assigneeId: ASSIGNEE, assignedAt: T1 },
      version: 1,
    });
    const ref = { taskId: TASK, ownerId: OWNER };
    expect(ar.pullEvents()).toEqual([
      { name: 'todo.task.unassigned', payload: { ...ref, assigneeId: OWNER } },
      { name: 'todo.task.assigned', payload: { ...ref, assigneeId: ASSIGNEE } },
    ]);
  });
});

describe('TaskAr.unassign', () => {
  const assigned = (status: TaskState['status']) =>
    TaskAr.restore({
      ...stored(status),
      assignment: { assigneeId: ASSIGNEE, assignedAt: T0 },
    });

  it.each(['open', 'done'] as const)(
    '%s: назначение снято, событие unassigned с прежним исполнителем',
    (status) => {
      const ar = assigned(status);
      expectOk(ar.unassign(T1));
      expect(ar.snapshot().assignment).toBeUndefined();
      expect(ar.isAssignedTo(ASSIGNEE)).toBe(false);
      expect(ar.pullEvents()).toEqual([
        {
          name: 'todo.task.unassigned',
          payload: { taskId: TASK, ownerId: OWNER, assigneeId: ASSIGNEE },
        },
      ]);
    },
  );

  it('без назначения — ok без изменений и событий (идемпотентность)', () => {
    const ar = TaskAr.restore(stored('open'));
    expectOk(ar.unassign(T1));
    expect(ar.version).toBe(0);
    expect(ar.pullEvents()).toEqual([]);
  });

  it('архивная — TASK_ARCHIVED', () => {
    const ar = assigned('archived');
    expectErr(ar.unassign(T1), 'TASK_ARCHIVED');
    expect(ar.isAssignedTo(ASSIGNEE)).toBe(true);
  });
});

describe('вопросы', () => {
  it('isAssignedTo: только текущий исполнитель', () => {
    const ar = TaskAr.restore({
      ...stored('open'),
      assignment: { assigneeId: ASSIGNEE, assignedAt: T0 },
    });
    expect(ar.isAssignedTo(ASSIGNEE)).toBe(true);
    expect(ar.isAssignedTo(OWNER)).toBe(false);
    expect(TaskAr.restore(stored('open')).isAssignedTo(ASSIGNEE)).toBe(false);
  });

  it('isOwnedBy: свой и чужой', () => {
    const ar = TaskAr.restore(stored('open'));
    expect(ar.isOwnedBy(OWNER)).toBe(true);
    expect(ar.isOwnedBy(TASK)).toBe(false);
    expect(ar.ownerId).toBe(OWNER);
  });

  it('isOpen: только открытая задача', () => {
    expect(TaskAr.restore(stored('open')).isOpen()).toBe(true);
    expect(TaskAr.restore(stored('done')).isOpen()).toBe(false);
    expect(TaskAr.restore(stored('archived')).isOpen()).toBe(false);
  });
});
