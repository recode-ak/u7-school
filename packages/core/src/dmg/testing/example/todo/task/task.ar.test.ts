import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { expectErr, expectOk, resetNow, setNow } from '../../../index';
import { TaskAr } from './task.ar';
import type { TaskState } from './task.state';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);

const stored = (status: TaskState['status']): TaskState => ({
  uuid: TASK,
  ownerId: OWNER,
  title: 'Купить хлеб',
  status,
  createdAt: T0,
  updatedAt: T0,
});

beforeEach(() => setNow(T1));
afterEach(() => resetNow());

describe('TaskAr.create', () => {
  it('открытая задача владельца и событие created', () => {
    const ar = expectOk(
      TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Купить хлеб' }),
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

describe('TaskAr.complete', () => {
  it('open → done, время выполнения и событие completed', () => {
    const ar = TaskAr.restore(stored('open'));
    expectOk(ar.complete());
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
    expectErr(ar.complete(), 'TASK_ALREADY_DONE');
    expect(ar.pullEvents()).toEqual([]);
  });

  it('архивная — TASK_ARCHIVED', () => {
    const ar = TaskAr.restore(stored('archived'));
    expectErr(ar.complete(), 'TASK_ARCHIVED');
    expect(ar.isArchived()).toBe(true);
  });
});

describe('TaskAr.archive', () => {
  it.each(['open', 'done'] as const)(
    '%s → archived и событие archived',
    (status) => {
      const ar = TaskAr.restore(stored(status));
      expectOk(ar.archive());
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
    expectErr(ar.archive(), 'TASK_ARCHIVED');
  });
});

describe('вопросы', () => {
  it('isOwnedBy: свой и чужой', () => {
    const ar = TaskAr.restore(stored('open'));
    expect(ar.isOwnedBy(OWNER)).toBe(true);
    expect(ar.isOwnedBy(TASK)).toBe(false);
    expect(ar.ownerId).toBe(OWNER);
  });
});
