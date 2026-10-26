import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VersionConflict } from '#core/app/uow/repository';
import { TaskAr } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { expectOk } from '#core/testing/index';
import { TaskJsonRepo } from './task.json-repo';

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);

let dir: string;
let repo: TaskJsonRepo;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'task-repo-'));
  repo = new TaskJsonRepo(join(dir, 'tasks.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const create = () =>
  expectOk(TaskAr.create({ uuid: ID, ownerId: OWNER, title: 'Хлеб' }, T0));

describe('TaskJsonRepo — версия', () => {
  it('записанный агрегат читается с той же версией', async () => {
    const ar = create();
    await repo.save(ar);
    expect((await repo.findById(ID))?.version).toBe(0);
  });

  it('две копии одной записи: вторая запись — VersionConflict', async () => {
    await repo.save(create());
    const first = await repo.findById(ID);
    const second = await repo.findById(ID);
    if (!first || !second) throw new Error('запись не найдена');
    expectOk(first.complete(T0));
    expectOk(second.archive(T0));
    await repo.save(first);
    await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
    expect((await repo.findById(ID))?.isDone()).toBe(true);
  });

  it('параллельные записи разных агрегатов не теряют друг друга', async () => {
    const other = expectOk(
      TaskAr.create(
        {
          uuid: '1c7a3d2f-9b5e-4a4c-8d3f-2e6b8c0f4a21',
          ownerId: OWNER,
          title: 'Молоко',
        },
        T0,
      ),
    );
    await Promise.all([repo.save(create()), repo.save(other)]);
    expect(await repo.findActiveByOwner(OWNER)).toHaveLength(2);
  });
});

describe('TaskJsonRepo — выборки', () => {
  const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const row = (status: TaskState['status'], assigneeId?: string) => ({
    uuid: crypto.randomUUID(),
    ownerId: OWNER,
    title: 'Задача',
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
    ...(assigneeId && { assignment: { assigneeId, assignedAt: T0 } }),
  });

  it('findActiveByOwner — неархивные задачи владельца', async () => {
    const open = row('open');
    const done = row('done');
    const other = { ...row('open'), ownerId: ASSIGNEE };
    await Bun.write(
      join(dir, 'tasks.json'),
      JSON.stringify([open, done, row('archived'), other]),
    );
    const found = await repo.findActiveByOwner(OWNER);
    expect(found.map((t) => t.uuid)).toEqual([open.uuid, done.uuid]);
  });

  it('findActiveByParticipant — неархивные задачи, где пользователь владелец или исполнитель, без дублей', async () => {
    const own = { ...row('open'), ownerId: ASSIGNEE };
    const ownSelf = { ...row('done', ASSIGNEE), ownerId: ASSIGNEE };
    const assigned = row('open', ASSIGNEE);
    await Bun.write(
      join(dir, 'tasks.json'),
      JSON.stringify([
        own,
        ownSelf,
        assigned,
        row('archived', ASSIGNEE),
        { ...row('archived'), ownerId: ASSIGNEE },
        row('open', OWNER),
        row('open'),
      ]),
    );
    const found = await repo.findActiveByParticipant(ASSIGNEE);
    expect(found.map((t) => t.uuid)).toEqual([
      own.uuid,
      ownSelf.uuid,
      assigned.uuid,
    ]);
  });
});
