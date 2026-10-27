import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import {
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/shared/app-user';
import { TaskAr, TodoModuleDef } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { GetTaskUc } from './get-task.uc';

// Query для других модулей (D-43): вызывается только системой, Policy —
// по человеку, от имени которого пришёл вызов; выход — state задачи.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STRANGER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const from: OperationRef = { kind: 'useCase', module: 'digest', name: 'show' };
const person = (uuid: string) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => false });
const onBehalfOf = (uuid: string) => new SystemCaller(from, person(uuid));

const task: TaskState = {
  uuid: TASK,
  ownerId: OWNER,
  title: 'Купить хлеб',
  status: 'open',
  createdAt: T0,
  updatedAt: T0,
  version: 0,
};

let dir: string;
let file: string;
let ctx: ReturnType<typeof testAppContext>;
let uc: GetTaskUc;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'get-task-'));
  file = join(dir, 'tasks.json');
  await Bun.write(file, JSON.stringify([task]));
  ctx = testAppContext({ at: T0 });
  uc = new GetTaskUc(
    {
      app: ctx.app,
      facades: new ModuleFacades(),
      tasks: new TaskJsonRepo(file),
    },
    TodoModuleDef,
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('GetTaskUc', () => {
  it('по просьбе владельца — state задачи, из него собирается ReadonlyAr', async () => {
    const view = expectOk(
      await uc.handle({ taskId: TASK }, onBehalfOf(OWNER), REQ),
    );
    expect(view).toEqual(task);
    expect(TaskAr.readonly(view).isOpen()).toBe(true);
    expect(ctx.published).toEqual([]);
  });

  it('по просьбе чужого — ACCESS_DENIED', async () => {
    expectErr(
      await uc.handle({ taskId: TASK }, onBehalfOf(STRANGER), REQ),
      'ACCESS_DENIED',
    );
  });

  it('системный вызов без человека — ACCESS_DENIED: Policy по субъекту', async () => {
    expectErr(
      await uc.handle({ taskId: TASK }, new SystemCaller(from), REQ),
      'ACCESS_DENIED',
    );
  });

  it('нет задачи — TASK_NOT_FOUND', async () => {
    const missing = crypto.randomUUID();
    const res = await uc.handle({ taskId: missing }, onBehalfOf(OWNER), REQ);
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: missing,
    });
  });

  it('пользователь напрямую — UNAUTHORIZED: только system', async () => {
    expectErr(
      await uc.handle({ taskId: TASK }, person(OWNER), REQ),
      'UNAUTHORIZED',
    );
  });
});
