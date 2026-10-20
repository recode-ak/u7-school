import { describe, expect, it } from 'bun:test';
import { ok } from '#core/kernel/result/result';
import { TaskAr } from './task.ar';
import { TaskErrors } from './task.errors';
import { OPEN_TASKS_LIMIT, type OwnerTasksCtx, TaskRules } from './task.rules';
import type { TaskState } from './task.state';

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

const task = (n: number, status: TaskState['status']): TaskAr =>
  TaskAr.restore({
    uuid: `0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f1${n}`,
    ownerId: OWNER,
    title: `Задача ${n}`,
    status,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  });

const ctx = (...statuses: TaskState['status'][]): OwnerTasksCtx => ({
  ownerTasks: statuses.map((s, i) => task(i, s)),
});

const { withinOpenLimit } = TaskRules.rules;

describe('TaskRules.withinOpenLimit', () => {
  it('открытых меньше предела — ok', () => {
    expect(OPEN_TASKS_LIMIT).toBe(3);
    expect(withinOpenLimit.check(ctx())).toEqual(ok());
    expect(withinOpenLimit.check(ctx('open', 'open'))).toEqual(ok());
  });

  it('выполненные и архивные не считаются', () => {
    expect(
      withinOpenLimit.check(ctx('open', 'open', 'done', 'archived')),
    ).toEqual(ok());
  });

  it('открытых уже предел — TASK_TOO_MANY_OPEN с пределом', () => {
    expect(withinOpenLimit.check(ctx('open', 'open', 'open'))).toEqual(
      TaskErrors.TOO_MANY_OPEN.err({ limit: OPEN_TASKS_LIMIT }),
    );
  });
});
