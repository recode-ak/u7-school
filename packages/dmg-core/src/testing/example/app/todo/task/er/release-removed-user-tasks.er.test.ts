import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { testAppContext } from '#core/testing/app-context';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { UserEvents } from '#core/testing/example/users/contract';
import { expectOk } from '#core/testing/expect-result';
import { expectIdempotentReaction } from '#core/testing/reaction-idempotency';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { ReleaseRemovedUserTasksEr } from './release-removed-user-tasks.er';

// Реакция на событие внешнего модуля через DCS: ER загружает задачи
// удалённого пользователя (свои и назначенные ему), решение — `TaskReleaseDcs`.
// Репозиторий — настоящий во временном каталоге.

const REMOVED = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);

let dir: string;
let file: string;
let tasks: TaskJsonRepo;
let ctx: ReturnType<typeof testAppContext>;
let er: ReleaseRemovedUserTasksEr;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dmg-er-'));
  file = path.join(dir, 'tasks.json');
  tasks = new TaskJsonRepo(file);
  ctx = testAppContext({ at: T1 });
  er = new ReleaseRemovedUserTasksEr(
    { app: ctx.app, facades: new ModuleFacades(), tasks },
    TodoModuleDef,
  );
});
afterEach(() => rm(dir, { recursive: true, force: true }));

/** Задача в файле — как от прежних сессий. */
const row = (
  ownerId: string,
  status: TaskState['status'] = 'open',
  assigneeId?: string,
): TaskState => ({
  uuid: crypto.randomUUID(),
  ownerId,
  title: 'Задача',
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...(assigneeId && { assignment: { assigneeId, assignedAt: T0 } }),
});

const seed = (rows: readonly TaskState[]) =>
  Bun.write(file, JSON.stringify(rows));

const removed = {
  ...UserEvents.removed.make({ userId: REMOVED }),
  eventId: 'e-removed',
  occurredAt: T1,
  aggregateId: REMOVED,
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
} as const;

const stored = async (uuid: string) => (await tasks.findById(uuid))?.snapshot();

const published = () => ctx.published.map((e) => [e.name, e.payload]);

describe('ReleaseRemovedUserTasksEr', () => {
  test('свои задачи — в архив, назначенные ему чужие — владельцам', async () => {
    const ownOpen = row(REMOVED);
    const ownDone = row(REMOVED, 'done', OTHER);
    const assigned = row(OTHER, 'open', REMOVED);
    const foreign = row(OTHER);
    await seed([ownOpen, ownDone, assigned, foreign]);

    expectOk(await er.handle(removed));

    expect((await stored(ownOpen.uuid))?.status).toBe('archived');
    expect((await stored(ownDone.uuid))?.status).toBe('archived');
    const released = await stored(assigned.uuid);
    expect(released).toMatchObject({ status: 'open', version: 1 });
    expect(released?.assignment).toBeUndefined();
    expect(await stored(foreign.uuid)).toEqual(foreign);
    expect(published()).toEqual([
      ['todo.task.archived', { taskId: ownOpen.uuid, ownerId: REMOVED }],
      ['todo.task.archived', { taskId: ownDone.uuid, ownerId: REMOVED }],
      [
        'todo.task.unassigned',
        { taskId: assigned.uuid, ownerId: OTHER, assigneeId: REMOVED },
      ],
    ]);
  });

  test('своя задача, назначенная себе, — одна запись и одно событие', async () => {
    const own = row(REMOVED, 'open', REMOVED);
    await seed([own]);

    expectOk(await er.handle(removed));

    expect(await stored(own.uuid)).toMatchObject({
      status: 'archived',
      version: 1,
    });
    expect(published()).toEqual([
      ['todo.task.archived', { taskId: own.uuid, ownerId: REMOVED }],
    ]);
  });

  test('задач у пользователя нет — Ok, файл не создан', async () => {
    expectOk(await er.handle(removed));
    expect(await Bun.file(file).exists()).toBe(false);
    expect(ctx.published).toEqual([]);
  });

  test('повтор users.user.removed с новым eventId — без записей и событий (D-47)', async () => {
    await seed([row(REMOVED), row(OTHER, 'open', REMOVED)]);
    await expectIdempotentReaction({
      event: removed,
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => Bun.file(file).text(),
    });
  });
});
