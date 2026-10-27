import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import {
  type Caller,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/shared/app-user';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { CompleteTaskUc } from './complete-task.uc';

// Command над существующим агрегатом с Policy: каждый недопустимый статус —
// отказ перехода Ar (`rejects`), UC статусы не сравнивает.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STRANGER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const as = (uuid: string, admin = false) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => admin });

let dir: string;
let file: string;
let tasks: TaskJsonRepo;
let ctx: ReturnType<typeof testAppContext>;
let uc: CompleteTaskUc;

const seed = (status: TaskState['status'] = 'open') =>
  Bun.write(
    file,
    JSON.stringify([
      {
        uuid: TASK,
        ownerId: OWNER,
        title: 'Купить хлеб',
        status,
        createdAt: T0,
        updatedAt: T0,
        version: 0,
      } satisfies TaskState,
    ]),
  );

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'complete-task-'));
  file = join(dir, 'tasks.json');
  tasks = new TaskJsonRepo(file);
  ctx = testAppContext({ at: T1 });
  uc = new CompleteTaskUc(
    { app: ctx.app, facades: new ModuleFacades(), tasks },
    TodoModuleDef,
  );
  await seed();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const complete = (caller: Caller<ExampleUser> = as(OWNER), taskId = TASK) =>
  uc.handle({ taskId }, caller, REQ);

/** Отказ: файл задач не изменён, событий нет. */
async function expectNothingWritten(before: string) {
  expect(await Bun.file(file).text()).toBe(before);
  expect(ctx.published).toEqual([]);
}

describe('CompleteTaskUc', () => {
  it('владелец выполняет открытую задачу — done, событие completed', async () => {
    expect(expectOk(await complete())).toEqual({});
    expect((await tasks.findById(TASK))?.snapshot()).toMatchObject({
      status: 'done',
      completedAt: T1,
      version: 1,
    });
    expect(ctx.published.map((e) => [e.name, e.payload])).toEqual([
      ['todo.task.completed', { taskId: TASK, ownerId: OWNER }],
    ]);
  });

  it('администратор выполняет чужую задачу', async () => {
    expectOk(await complete(as(STRANGER, true)));
    expect((await tasks.findById(TASK))?.isDone()).toBe(true);
  });

  it('нет задачи — TASK_NOT_FOUND', async () => {
    const missing = crypto.randomUUID();
    const res = await complete(as(OWNER), missing);
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: missing,
    });
  });

  it('не владелец — ACCESS_DENIED', async () => {
    const before = await Bun.file(file).text();
    expectErr(await complete(as(STRANGER)), 'ACCESS_DENIED');
    await expectNothingWritten(before);
  });

  it('уже выполнена — TASK_ALREADY_DONE', async () => {
    await seed('done');
    const before = await Bun.file(file).text();
    expectErr(await complete(), 'TASK_ALREADY_DONE');
    await expectNothingWritten(before);
  });

  it('в архиве — TASK_ARCHIVED', async () => {
    await seed('archived');
    const before = await Bun.file(file).text();
    expectErr(await complete(), 'TASK_ARCHIVED');
    await expectNothingWritten(before);
  });

  it('системный вызов — UNAUTHORIZED: callers только user и delegate', async () => {
    const job = new SystemCaller<ExampleUser>({
      kind: 'job',
      module: 'todo',
      name: 'archiveDoneTasks',
    });
    expectErr(await complete(job), 'UNAUTHORIZED');
  });
});
