import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiApp } from '#core/app/api-app/api-app';
import {
  GuestCaller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import {
  AssignTaskUcDef,
  CreateTaskUcDef,
  GetTaskUcDef,
  TodoModuleDef,
} from '#core/testing/example/todo/contract';
import {
  RemoveUserUcDef,
  UsersModuleDef,
} from '#core/testing/example/users/contract';
import {
  AwaitingBus,
  expectErr,
  expectOk,
  MemoryLogger,
  testAppContext,
} from '#core/testing/index';
import type { ExampleUser } from '../shared/app-user';
import { ExampleApp } from './example-app';
import { ExampleCallerResolver } from './example-caller-resolver';

// Учебное приложение целиком: окружение → контекст, модули по `dependsOn`,
// резолвер `Caller`, запуск и остановка реакций. Порты подменены
// (`AwaitingBus`, `MemoryLogger`, часы); данные — во временном каталоге.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const STRANGER = '1f2e3d4c-5b6a-4978-8a1b-2c3d4e5f6a7b';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const admin: OperationRef = { kind: 'useCase', module: 'admin', name: 'purge' };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'example-app-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeApp() {
  const bus = new AwaitingBus();
  const example = new ExampleApp(
    { mode: 'test', dataDir: dir, users: [OWNER, OTHER] },
    { bus, logger: new MemoryLogger(), clock: () => T0 },
  );
  return { example, bus };
}

async function userCaller(example: ExampleApp, uuid: string) {
  const caller = await example.callers.resolve(uuid, REQ);
  if (!(caller instanceof UserCaller)) {
    throw new Error(`Пользователь ${uuid} не распознан`);
  }
  return caller;
}

/** Задача владельца `OWNER`, назначенная на `OTHER`. */
async function assignedTask(example: ExampleApp) {
  const owner = await userCaller(example, OWNER);
  const { taskId } = expectOk(
    await example.api.dispatch(
      TodoModuleDef,
      CreateTaskUcDef.command({ title: 'Хлеб' }),
      owner,
      REQ,
    ),
  );
  expectOk(
    await example.api.dispatch(
      TodoModuleDef,
      AssignTaskUcDef.command({ taskId, assigneeId: OTHER }),
      owner,
      REQ,
    ),
  );
  return { owner, taskId };
}

async function removeOther(example: ExampleApp) {
  expectOk(
    await example.api.dispatch(
      UsersModuleDef,
      RemoveUserUcDef.command({ userId: OTHER }),
      new SystemCaller<ExampleUser>(admin),
      REQ,
    ),
  );
}

async function assigneeOf(
  example: ExampleApp,
  owner: UserCaller<ExampleUser>,
  taskId: string,
) {
  const task = expectOk(
    await example.api.dispatch(
      TodoModuleDef,
      GetTaskUcDef.command({ taskId }),
      new SystemCaller(admin, owner),
      REQ,
    ),
  );
  return task.assignment?.assigneeId;
}

describe('ExampleApp: сборка', () => {
  it('todo вызывает users через фасад по dependsOn: исполнитель проверен', async () => {
    const { example } = makeApp();
    const { owner, taskId } = await assignedTask(example);

    expect(await assigneeOf(example, owner, taskId)).toBe(OTHER);
  });

  it('исполнитель не из users — ошибка users через фасад', async () => {
    const { example } = makeApp();
    const owner = await userCaller(example, OWNER);
    const { taskId } = expectOk(
      await example.api.dispatch(
        TodoModuleDef,
        CreateTaskUcDef.command({ title: 'Хлеб' }),
        owner,
        REQ,
      ),
    );

    const res = await example.api.dispatch(
      TodoModuleDef,
      AssignTaskUcDef.command({ taskId, assigneeId: STRANGER }),
      owner,
      REQ,
    );

    expectErr(res, 'USER_NOT_FOUND');
  });

  it('UC пишется в лог операций — JSONL по дням в dataDir/oplog', async () => {
    const { example } = makeApp();
    const owner = await userCaller(example, OWNER);
    const { taskId } = expectOk(
      await example.api.dispatch(
        TodoModuleDef,
        CreateTaskUcDef.command({ title: 'Хлеб' }),
        owner,
        REQ,
      ),
    );

    const records = readFileSync(join(dir, 'oplog', '2026-10-01.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((record) => record.op === 'createTask');

    expect(records).toEqual([
      expect.objectContaining({
        module: 'todo',
        kind: 'useCase',
        caller: { kind: 'user', subjectId: OWNER },
        input: { title: 'Хлеб' },
        result: { ok: true, output: { taskId } },
      }),
    ]);
  });
});

describe('ExampleApp.callers', () => {
  it('известный uuid — UserCaller без ролей', async () => {
    const { example } = makeApp();

    const caller = await userCaller(example, OWNER);

    expect(caller.subject().uuid).toBe(OWNER);
    expect(caller.subject().hasRole('admin')).toBe(false);
  });

  it('неизвестный uuid — GuestCaller', async () => {
    const { example } = makeApp();

    expect(await example.callers.resolve(STRANGER, REQ)).toBeInstanceOf(
      GuestCaller,
    );
  });

  it('нет идентичности — GuestCaller', async () => {
    const { example } = makeApp();

    expect(await example.callers.resolve(undefined, REQ)).toBeInstanceOf(
      GuestCaller,
    );
  });

  it('удалённый пользователь — GuestCaller', async () => {
    const { example } = makeApp();
    await removeOther(example);

    expect(await example.callers.resolve(OTHER, REQ)).toBeInstanceOf(
      GuestCaller,
    );
  });

  it('резолвер вызывает users от приложения — в oplog from.kind: app (D-51)', async () => {
    const { example } = makeApp();
    await example.callers.resolve(OWNER, REQ);

    const records = readFileSync(join(dir, 'oplog', '2026-10-01.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((record) => record.op === 'getUser');

    expect(records).toEqual([
      expect.objectContaining({
        module: 'users',
        kind: 'useCase',
        caller: {
          kind: 'system',
          from: { kind: 'app', module: 'example-app', name: 'resolveCaller' },
        },
      }),
    ]);
  });

  it('users не подключён — исключение, а не гость', async () => {
    const callers = new ExampleCallerResolver(
      new ApiApp<ExampleUser>(testAppContext().app, []),
    );

    await expect(callers.resolve(OWNER, REQ)).rejects.toThrow(
      'Резолвер Caller: users.getUser вернул OPERATION_NOT_FOUND',
    );
  });
});

describe('ExampleApp.start', () => {
  it('после start() удаление пользователя доходит до реакции todo', async () => {
    const { example, bus } = makeApp();
    const { owner, taskId } = await assignedTask(example);
    example.start();

    await removeOther(example);
    await bus.delivered();

    expect(await assigneeOf(example, owner, taskId)).toBeUndefined();
  });

  it('повторный start() без остановки — исключение; после остановки — можно', () => {
    const { example } = makeApp();
    const stop = example.start();
    expect(() => example.start()).toThrow(
      'Реакции приложения уже подписаны на шину',
    );
    stop();
    expect(() => example.start()).not.toThrow();
  });

  it('остановка снимает подписки: реакция не срабатывает', async () => {
    const { example, bus } = makeApp();
    const { owner, taskId } = await assignedTask(example);
    const stop = example.start();
    stop();

    await removeOther(example);
    await bus.delivered();

    expect(await assigneeOf(example, owner, taskId)).toBe(OTHER);
  });
});
