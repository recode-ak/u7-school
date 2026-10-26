import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { SystemCaller, UserCaller } from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { ListTasksUc } from './list-tasks.uc';

// Query субъекта: только свои данные (`userId` из вызывающего, не из
// входа), выход — поля схемы output, ничего не пишется.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const as = (uuid: string) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => false });

const row = (
  ownerId: string,
  title: string,
  status: TaskState['status'] = 'open',
): TaskState => ({
  uuid: crypto.randomUUID(),
  ownerId,
  title,
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...(status === 'done' && { completedAt: T0 }),
});

let dir: string;
let file: string;
let ctx: ReturnType<typeof testAppContext>;
let uc: ListTasksUc;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'list-tasks-'));
  file = join(dir, 'tasks.json');
  ctx = testAppContext({ at: T0 });
  uc = new ListTasksUc(
    {
      app: ctx.app,
      facades: new ModuleFacades(),
      tasks: new TaskJsonRepo(file),
    },
    TodoModuleDef,
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ListTasksUc', () => {
  it('неархивные задачи вызывающего — только uuid, title, status', async () => {
    const open = row(OWNER, 'Хлеб');
    const done = row(OWNER, 'Молоко', 'done');
    await Bun.write(
      file,
      JSON.stringify([
        open,
        done,
        row(OWNER, 'Старое', 'archived'),
        row(OTHER, 'Чужое'),
      ]),
    );

    const res = await uc.handle({}, as(OWNER), REQ);

    expect(expectOk(res)).toEqual([
      { uuid: open.uuid, title: 'Хлеб', status: 'open' },
      { uuid: done.uuid, title: 'Молоко', status: 'done' },
    ]);
  });

  it('задач нет — пустой список, ничего не записано', async () => {
    expect(expectOk(await uc.handle({}, as(OWNER), REQ))).toEqual([]);
    expect(await Bun.file(file).exists()).toBe(false);
    expect(ctx.published).toEqual([]);
  });

  it('системный вызов — UNAUTHORIZED: callers только user и delegate', async () => {
    const job = new SystemCaller<ExampleUser>({
      kind: 'job',
      module: 'todo',
      name: 'archiveDoneTasks',
    });
    expectErr(await uc.handle({}, job, REQ), 'UNAUTHORIZED');
  });
});
