import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { UserCaller } from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import { OPEN_TASKS_LIMIT } from '#core/testing/example/todo/task/task.rules';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { CreateTaskUc } from './create-task.uc';

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const owner = new UserCaller<ExampleUser>({
  uuid: OWNER,
  hasRole: () => false,
});

let dir: string;
let tasks: TaskJsonRepo;
let ctx: ReturnType<typeof testAppContext>;
let uc: CreateTaskUc;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'create-task-'));
  tasks = new TaskJsonRepo(join(dir, 'tasks.json'));
  ctx = testAppContext({ at: Date.UTC(2026, 9, 1) });
  uc = new CreateTaskUc(
    { app: ctx.app, facades: new ModuleFacades(), tasks },
    TodoModuleDef,
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const create = (title: string) => uc.handle({ title }, owner, REQ);

describe('CreateTaskUc — доменное правило предела открытых задач', () => {
  it('до предела задачи создаются', async () => {
    for (let i = 0; i < OPEN_TASKS_LIMIT; i++) {
      expectOk(await create(`Задача ${i}`));
    }
    expect(await tasks.findActiveByOwner(OWNER)).toHaveLength(OPEN_TASKS_LIMIT);
  });

  it('сверх предела — ошибка правила, ничего не зафиксировано', async () => {
    for (let i = 0; i < OPEN_TASKS_LIMIT; i++) await create(`Задача ${i}`);
    const published = ctx.published.length;
    const res = await create('Лишняя');
    expect(expectErr(res, 'TASK_TOO_MANY_OPEN').payload).toEqual({
      limit: OPEN_TASKS_LIMIT,
    });
    expect(await tasks.findActiveByOwner(OWNER)).toHaveLength(OPEN_TASKS_LIMIT);
    expect(ctx.published).toHaveLength(published);
  });
});
