import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ok, SystemCaller, UserCaller } from 'dmg-core';
import {
  InProcInbox,
  InProcOutbox,
  JsonlOperationLog,
  ModuleFacade,
  ModuleFacades,
  Trace,
} from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  type LogRecord,
  memoryLogger,
} from 'dmg-core/testing';
import type { ExampleUser } from 'dmg-core/testing/example/app/app-user';
import { TaskJsonRepo } from 'dmg-core/testing/example/app/todo/infra/task.json-repo';
import {
  createTodoModule,
  type TodoDeps,
} from 'dmg-core/testing/example/app/todo/todo.module';
import { UserMemoryRepo } from 'dmg-core/testing/example/app/users/infra/user.memory-repo';
import { createUsersModule } from 'dmg-core/testing/example/app/users/users.module';
import {
  ArchiveDoneTasksJobDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  GetTaskUcDef,
  ListTasksUcDef,
  TaskAr,
  TaskEvents,
} from 'dmg-core/testing/example/todo/index';
import { RemoveUserUcDef } from 'dmg-core/testing/example/users/index';
import { ApiApp } from '../api/app/api-app';
import type { AppMeta } from '../domain/types';
import { InProcEventBus } from '../infra/in-proc-event-bus';
import { legacyClock, legacyEventBus, legacyJob } from './index';

const ANNA = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const BORIS = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';

const caller = (uuid: string, admin = false) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => admin });

let dir: string;
let legacy: InProcEventBus;
let deps: TodoDeps;
let api: ApiApp<AppMeta, ExampleUser>;
let logs: LogRecord[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dmg-todo-'));
  legacy = new InProcEventBus();
  logs = [];
  const bus = legacyEventBus(legacy);
  deps = {
    app: {
      bus,
      outbox: new InProcOutbox(bus),
      inbox: new InProcInbox(),
      clock: legacyClock(),
      logger: memoryLogger(logs),
      mode: 'test',
      // Как в приложении (`<DB_DIR>/oplog/`), но во временном каталоге.
      oplog: new JsonlOperationLog(path.join(dir, 'oplog')),
    },
    facades: new ModuleFacades(),
    tasks: new TaskJsonRepo(path.join(dir, 'tasks.json')),
  };
  const users = new UserMemoryRepo([
    { uuid: ANNA, createdAt: 0, updatedAt: 0, version: 0, status: 'active' },
  ]);
  api = new ApiApp<AppMeta, ExampleUser>([]).addDmgModules(
    createUsersModule({ app: deps.app, facades: deps.facades, users }),
    createTodoModule(deps),
  );
  api.init({ start: () => {}, stop: () => {} });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

async function create(title: string, owner = ANNA): Promise<string> {
  const res = await api.run(CreateTaskUcDef, { title }, caller(owner), req());
  return expectOk(res).taskId;
}

async function titles(owner = ANNA): Promise<string[]> {
  const res = await api.run(ListTasksUcDef, {}, caller(owner), req());
  return expectOk(res).map((t) => `${t.title}:${t.status}`);
}

/** След запроса транспорта: в тестах — новый requestId на вызов. */
const req = (): Trace => Trace.fromRequest({ requestId: crypto.randomUUID() });

/** Реакции legacy-шина вызывает без ожидания — дать им отработать. */
const settle = () => new Promise((r) => setTimeout(r, 10));

describe('todo: сквозной сценарий через appApi.run', () => {
  test('создать → выполнить → в списке выполнена', async () => {
    const id = await create('Купить хлеб');
    expectOk(
      await api.run(CompleteTaskUcDef, { taskId: id }, caller(ANNA), req()),
    );
    expect(await titles()).toEqual(['Купить хлеб:done']);
  });

  test('список — только задачи вызывающего', async () => {
    await create('Анна', ANNA);
    await create('Борис', BORIS);
    expect(await titles(BORIS)).toEqual(['Борис:open']);
  });

  test('чужую задачу выполнить нельзя, администратору можно', async () => {
    const id = await create('Купить хлеб');
    const foreign = await api.run(
      CompleteTaskUcDef,
      { taskId: id },
      caller(BORIS),
      req(),
    );
    expectErr(foreign, 'ACCESS_DENIED');
    const admin = caller(BORIS, true);
    expectOk(await api.run(CompleteTaskUcDef, { taskId: id }, admin, req()));
  });

  test('событие уходит в общую шину — legacy-подписчик его видит', async () => {
    const seen: string[] = [];
    legacy.subscribe('todo.task.created', async (e) => {
      seen.push(e.eventName);
    });
    await create('Купить хлеб');
    expect(seen).toEqual(['todo.task.created']);
  });
});

describe('todo: событие → ER', () => {
  test('удаление пользователя в users архивирует его задачи в todo', async () => {
    await create('Анна 1');
    await create('Борис', BORIS);
    const archived: string[] = [];
    deps.app.bus.subscribe(TaskEvents.archived, async (e) => {
      archived.push(e.correlationId);
    });
    const admin = new SystemCaller<ExampleUser>({
      kind: 'job',
      module: 'admin',
      name: 'removeUsers',
    });
    const trace = Trace.fromRequest({ requestId: 'r-remove' });
    expectOk(await api.run(RemoveUserUcDef, { userId: ANNA }, admin, trace));
    await settle();
    expect(archived).toEqual(['r-remove']);
    expect([await titles(ANNA), await titles(BORIS)]).toEqual([
      [],
      ['Борис:open'],
    ]);
    expect(logs).toEqual([]);
  });
});

describe('todo: Job на существующем планировщике', () => {
  test('выполненные задачи уходят в архив', async () => {
    const id = await create('Купить хлеб');
    await create('Позвонить');
    expectOk(
      await api.run(CompleteTaskUcDef, { taskId: id }, caller(ANNA), req()),
    );
    await legacyJob(createTodoModule(deps), ArchiveDoneTasksJobDef).execute();
    expect(await titles()).toEqual(['Позвонить:open']);
  });
});

describe('todo: фасад', () => {
  // Вызов от операции другого модуля, объявившей getTask в calls (D-43).
  const from = () =>
    new SystemCaller(
      { kind: 'useCase', module: 'digest', name: 'showTask' },
      caller(ANNA),
    );
  const getTask = async (taskId: string) => {
    const res = await new ModuleFacade(createTodoModule(deps)).handle(
      GetTaskUcDef,
      { taskId },
      from(),
      req(),
    );
    return res.ok ? ok(TaskAr.readonly(res.value)) : res;
  };

  test('getTask: ReadonlyAr строит вызывающий — задача только для чтения', async () => {
    const id = await create('Купить хлеб');
    const task = expectOk(await getTask(id));
    expect([task.uuid, task.isDone()]).toEqual([id, false]);
    // @ts-expect-error: ReadonlyAr — мутирующих методов нет (API-04)
    expect(task.complete).toBeDefined();
  });

  test('нет задачи — TASK_NOT_FOUND', async () => {
    expectErr(await getTask(ANNA), 'TASK_NOT_FOUND');
  });
});
