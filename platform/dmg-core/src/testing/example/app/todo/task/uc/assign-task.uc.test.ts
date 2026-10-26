import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { UserCaller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import { TodoModuleDef } from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import {
  GetUserUcDef,
  type UserActivity,
  UserErrors,
  UsersModuleDef,
} from '#core/testing/example/users/contract';
import {
  expectErr,
  expectOk,
  StubFacade,
  testAppContext,
} from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { AssignTaskUc } from './assign-task.uc';

// Command с вызовом чужого модуля: `users` — `StubFacade` по Def из его
// контракта (ARC-06), решение над ответом — правило `assigneeActive`.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const ASSIGNEE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const as = (uuid: string) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => false });
const owner = as(OWNER);

let dir: string;
let file: string;
let tasks: TaskJsonRepo;
let users: StubFacade<typeof UsersModuleDef>;
let ctx: ReturnType<typeof testAppContext>;
let uc: AssignTaskUc;

/** Ответ `users` об исполнителе. */
const answer = (activity: UserActivity) =>
  users.answer(GetUserUcDef, () => ok(activity));

/** Задача владельца в файле — как от прежних сессий. */
const seed = (
  status: TaskState['status'] = 'open',
  assignment?: TaskState['assignment'],
) =>
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
        ...(assignment && { assignment }),
      } satisfies TaskState,
    ]),
  );

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'assign-task-'));
  file = join(dir, 'tasks.json');
  tasks = new TaskJsonRepo(file);
  users = new StubFacade(UsersModuleDef);
  answer({ userId: ASSIGNEE, active: true });
  ctx = testAppContext({ at: T1 });
  uc = new AssignTaskUc(
    { app: ctx.app, facades: new ModuleFacades([users]), tasks },
    TodoModuleDef,
  );
  await seed();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const assign = (caller = owner, taskId = TASK) =>
  uc.handle({ taskId, assigneeId: ASSIGNEE }, caller, REQ);

/** Отказ: файл задач не изменён, событий нет. */
async function expectNothingWritten(before: string) {
  expect(await Bun.file(file).text()).toBe(before);
  expect(ctx.published).toEqual([]);
}

describe('AssignTaskUc', () => {
  it('назначает исполнителя открытой задаче, событие assigned', async () => {
    expect(expectOk(await assign())).toEqual({});

    const stored = (await tasks.findById(TASK))?.snapshot();
    expect(stored).toMatchObject({
      status: 'open',
      version: 1,
      assignment: { assigneeId: ASSIGNEE, assignedAt: T1 },
    });
    expect(ctx.published.map((e) => [e.name, e.payload])).toEqual([
      [
        'todo.task.assigned',
        { taskId: TASK, ownerId: OWNER, assigneeId: ASSIGNEE },
      ],
    ]);
  });

  it('тот же исполнитель — ok, без изменений и событий', async () => {
    const assignment = { assigneeId: ASSIGNEE, assignedAt: T0 };
    await seed('open', assignment);

    expect(expectOk(await assign())).toEqual({});

    // Ar ничего не меняет; UC не ветвится по состоянию (API-01), поэтому
    // UoW записывает ту же версию — данные прежние.
    const stored = (await tasks.findById(TASK))?.snapshot();
    expect(stored).toMatchObject({ version: 0, updatedAt: T0, assignment });
    expect(ctx.published).toEqual([]);
  });

  it('другой исполнитель — unassigned прежнего, затем assigned нового', async () => {
    await seed('open', { assigneeId: OWNER, assignedAt: T0 });

    expectOk(await assign());

    const ref = { taskId: TASK, ownerId: OWNER };
    expect(ctx.published.map((e) => [e.name, e.payload])).toEqual([
      ['todo.task.unassigned', { ...ref, assigneeId: OWNER }],
      ['todo.task.assigned', { ...ref, assigneeId: ASSIGNEE }],
    ]);
    expect((await tasks.findById(TASK))?.snapshot().assignment).toEqual({
      assigneeId: ASSIGNEE,
      assignedAt: T1,
    });
  });

  it('users спрошен об исполнителе от имени UC с человеком пришедшего', async () => {
    expectOk(await assign());
    expect(users.received).toHaveLength(1);
    const [call] = users.received;
    expect(call?.def).toBe(GetUserUcDef);
    expect(call?.input).toEqual({ userId: ASSIGNEE });
    expect(call?.caller.from).toEqual(uc.ref);
    expect(call?.caller.person()).toBe(owner);
  });

  it('нет задачи — TASK_NOT_FOUND, users не спрошен', async () => {
    const missing = crypto.randomUUID();
    const before = await Bun.file(file).text();

    const res = await assign(owner, missing);

    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: missing,
    });
    expect(users.received).toEqual([]);
    await expectNothingWritten(before);
  });

  it('нет пользователя — USER_NOT_FOUND от users как есть', async () => {
    users.answer(GetUserUcDef, ({ userId }) =>
      UserErrors.NOT_FOUND.err({ userId }),
    );
    const before = await Bun.file(file).text();

    const res = await assign();

    expect(expectErr(res, 'USER_NOT_FOUND').payload).toEqual({
      userId: ASSIGNEE,
    });
    await expectNothingWritten(before);
  });

  it('не владелец — ACCESS_DENIED', async () => {
    const before = await Bun.file(file).text();
    expectErr(await assign(as(ASSIGNEE)), 'ACCESS_DENIED');
    await expectNothingWritten(before);
  });

  it('исполнитель неактивен — TASK_ASSIGNEE_INACTIVE', async () => {
    answer({ userId: ASSIGNEE, active: false });
    const before = await Bun.file(file).text();

    const res = await assign();

    expect(expectErr(res, 'TASK_ASSIGNEE_INACTIVE').payload).toEqual({
      assigneeId: ASSIGNEE,
    });
    await expectNothingWritten(before);
  });

  it('задача не открыта — TASK_NOT_ASSIGNABLE', async () => {
    await seed('done');
    const before = await Bun.file(file).text();
    expectErr(await assign(), 'TASK_NOT_ASSIGNABLE');
    await expectNothingWritten(before);
  });

  it('неактивный исполнитель и закрытая задача — отказ правила раньше перехода', async () => {
    await seed('done');
    answer({ userId: ASSIGNEE, active: false });
    expectErr(await assign(), 'TASK_ASSIGNEE_INACTIVE');
  });
});
