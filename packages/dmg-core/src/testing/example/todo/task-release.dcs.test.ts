import { describe, expect, it } from 'bun:test';
import { expectOk } from '#core/testing/index';
import { TaskAr } from './task/task.ar';
import type { TaskStatus } from './task/task.state';
import { TaskReleaseDcs } from './task-release.dcs';

const REMOVED = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);

const task = (status: TaskStatus, ownerId: string, assigneeId?: string) =>
  TaskAr.restore({
    uuid: crypto.randomUUID(),
    ownerId,
    title: 'Задача',
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
    ...(assigneeId && { assignment: { assigneeId, assignedAt: T0 } }),
  });

describe('TaskReleaseDcs.release — задачи удалённого пользователя', () => {
  it('свои задачи — в архив, назначенные ему чужие — владельцу', () => {
    const ownOpen = task('open', REMOVED);
    const ownDone = task('done', REMOVED, OTHER);
    const assigned = task('open', OTHER, REMOVED);

    const released = expectOk(
      new TaskReleaseDcs(REMOVED, [ownOpen, ownDone, assigned]).release(T1),
    );

    expect(released).toEqual({
      archived: [ownOpen, ownDone],
      unassigned: [assigned],
    });
    expect(ownDone.isArchived()).toBe(true);
    expect(assigned.isAssignedTo(REMOVED)).toBe(false);
    expect(assigned.isOpen()).toBe(true);
  });

  it('своя задача, назначенная себе, — только в архив', () => {
    const own = task('open', REMOVED, REMOVED);
    const released = expectOk(new TaskReleaseDcs(REMOVED, [own]).release(T1));
    expect(released).toEqual({ archived: [own], unassigned: [] });
  });

  it('чужие и архивные не меняются — сервис не верит выборке', () => {
    const foreign = task('open', OTHER);
    const archived = task('archived', REMOVED, REMOVED);
    const released = expectOk(
      new TaskReleaseDcs(REMOVED, [foreign, archived]).release(T1),
    );
    expect(released).toEqual({ archived: [], unassigned: [] });
    expect([foreign.version, archived.version]).toEqual([0, 0]);
  });

  it('повторное событие — ничего не меняет (идемпотентность)', () => {
    const tasks = [task('open', REMOVED), task('open', OTHER, REMOVED)];
    expectOk(new TaskReleaseDcs(REMOVED, tasks).release(T1));

    const again = expectOk(new TaskReleaseDcs(REMOVED, tasks).release(T1 + 1));
    expect(again).toEqual({ archived: [], unassigned: [] });
  });
});
