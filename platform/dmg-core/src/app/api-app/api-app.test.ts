import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleDef } from '#core/domain/contracts/module-def';
import {
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import { TaskJsonRepo } from '#core/testing/example/app/todo/infra/task.json-repo';
import { createTodoModule } from '#core/testing/example/app/todo/todo.module';
import { UserMemoryRepo } from '#core/testing/example/app/users/infra/user.memory-repo';
import { createUsersModule } from '#core/testing/example/app/users/users.module';
import {
  ArchiveDoneTasksJobDef,
  AssignTaskUcDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import {
  GetUserUcDef,
  RemoveUserUcDef,
  UsersModuleDef,
} from '#core/testing/example/users/contract';
import {
  AwaitingBus,
  expectErr,
  expectOk,
  testAppContext,
} from '#core/testing/index';
import type { AppContext, ModuleDeps } from '../context';
import type { EventEnvelope } from '../events/event-envelope';
import { InProcOutbox } from '../events/outbox';
import { ModuleFromDef } from '../module/module-from-def';
import { ApiApp } from './api-app';
import type { ModuleFactory } from './api-app.types';

// Сборка учебного приложения `users` + `todo` (todo зависит от users):
// порядок по `dependsOn`, фасады только зависимостей, проверка графа,
// вход команд, Job и реакции через `ApiApp`.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const owner = new UserCaller<ExampleUser>({
  uuid: OWNER,
  hasRole: () => false,
});
const other = new UserCaller<ExampleUser>({
  uuid: OTHER,
  hasRole: () => false,
});
const from: OperationRef = { kind: 'useCase', module: 'admin', name: 'purge' };
/** Системный вызов от операции `admin.purge` — UC, доступные только `system`. */
const adminPurge = new SystemCaller<ExampleUser>(from);

const userRow = (uuid: string) => ({
  uuid,
  status: 'active' as const,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-app-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Приложение: контекст, репозитории и фабрики, замкнутые на них. */
function makeApp() {
  const bus = new AwaitingBus();
  const app: AppContext = {
    ...testAppContext({ at: T0 }).app,
    bus,
    outbox: new InProcOutbox(bus),
  };
  const users = new UserMemoryRepo([userRow(OWNER), userRow(OTHER)]);
  const tasks = new TaskJsonRepo(join(dir, 'tasks.json'));
  const seen = new Map<string, ModuleDeps>();
  const usersModule: ModuleFactory<ExampleUser> = {
    def: UsersModuleDef,
    create: (deps) => {
      seen.set('users', deps);
      return createUsersModule({ ...deps, users });
    },
  };
  const todoModule: ModuleFactory<ExampleUser> = {
    def: TodoModuleDef,
    create: (deps) => {
      seen.set('todo', deps);
      return createTodoModule({ ...deps, tasks });
    },
  };
  return { app, bus, tasks, seen, usersModule, todoModule };
}

const passport = (name: string, dependsOn: readonly ModuleDef[]) =>
  ModuleDef.define({
    name,
    label: name,
    description: `Модуль ${name} для проверки графа.`,
    dependsOn,
    aggregates: [],
    useCases: [],
    reactions: [],
    jobs: [],
  });

/** Модуль без операций — для проверки графа. */
function bare(def: ReturnType<typeof passport>): ModuleFactory<ExampleUser> {
  return {
    def,
    create: (deps) =>
      new ModuleFromDef(def, { useCases: {}, reactions: {}, jobs: {} }, deps),
  };
}

async function createTask(api: ApiApp<ExampleUser>, caller = owner) {
  return expectOk(
    await api.dispatch(
      TodoModuleDef,
      CreateTaskUcDef.command({ title: 'Хлеб' }),
      caller,
      REQ,
    ),
  ).taskId;
}

describe('ApiApp: сборка', () => {
  it('фабрики в любом порядке — todo собирается после users и зовёт его через фасад', async () => {
    const { app, tasks, usersModule, todoModule } = makeApp();
    const api = new ApiApp(app, [todoModule, usersModule]);
    const taskId = await createTask(api);

    expectOk(
      await api.dispatch(
        TodoModuleDef,
        AssignTaskUcDef.command({ taskId, assigneeId: OTHER }),
        owner,
        REQ,
      ),
    );

    expect((await tasks.findById(taskId))?.isAssignedTo(OTHER)).toBe(true);
  });

  it('модуль получает фасады только своих зависимостей', async () => {
    const { app, seen, usersModule, todoModule } = makeApp();
    new ApiApp(app, [todoModule, usersModule]);
    const facadesOf = (name: string) => {
      const deps = seen.get(name);
      if (deps === undefined) throw new Error(`Модуль ${name} не собран`);
      return deps.facades;
    };

    expectOk(
      await facadesOf('todo').call(
        GetUserUcDef,
        { userId: OWNER },
        adminPurge,
        REQ,
      ),
    );
    await expect(
      facadesOf('users').call(GetUserUcDef, { userId: OWNER }, adminPurge, REQ),
    ).rejects.toThrow('Нет фасада модуля для UC getUser');
  });

  it('цикл в dependsOn — исключение сборки с путём цикла', () => {
    const a = passport('a', []);
    const b = passport('b', [a]);
    // Тот же модуль `a`, но уже зависимый от `b`: граф строится по имени, и
    // цикл ловится до сверки Def по ссылке.
    const aOnB = passport('a', [b]);
    const { app } = makeApp();

    expect(() => new ApiApp(app, [bare(aOnB), bare(b)])).toThrow(
      'Цикл в dependsOn: a → b → a',
    );
  });

  it('зависимость без фабрики — исключение сборки', () => {
    const { app, todoModule } = makeApp();

    expect(() => new ApiApp(app, [todoModule])).toThrow(
      'Модуль todo зависит от users, но фабрики users в приложении нет',
    );
  });

  it('повтор модуля — исключение сборки', () => {
    const { app, usersModule } = makeApp();

    expect(() => new ApiApp(app, [usersModule, usersModule])).toThrow(
      'Модуль users подключён дважды',
    );
  });

  it('фабрика вернула модуль другого Def — исключение сборки', () => {
    const { app, usersModule } = makeApp();
    const wrong: ModuleFactory<ExampleUser> = {
      def: passport('audit', []),
      create: usersModule.create,
    };

    expect(() => new ApiApp(app, [wrong])).toThrow(
      'Фабрика модуля audit вернула модуль users',
    );
  });

  it('фабрика вернула модуль с другим объектом Def того же имени — исключение сборки', () => {
    const { app, usersModule } = makeApp();
    const twin: ModuleFactory<ExampleUser> = {
      def: passport('users', []),
      create: usersModule.create,
    };

    expect(() => new ApiApp(app, [twin])).toThrow(
      'Фабрика модуля users вернула модуль users: другой объект Def с тем же именем',
    );
  });

  it('Def зависимости — другой объект с тем же именем — исключение сборки', () => {
    const { app, todoModule } = makeApp();
    const twinUsers = bare(passport('users', []));

    expect(() => new ApiApp(app, [twinUsers, todoModule])).toThrow(
      'Модуль todo зависит от users, но фабрика users подключила другой объект Def с тем же именем',
    );
  });
});

describe('ApiApp.dispatch', () => {
  it('модуль не подключён — OPERATION_NOT_FOUND', async () => {
    const { app, usersModule } = makeApp();
    const api = new ApiApp(app, [usersModule]);

    const res = await api.dispatch(
      TodoModuleDef,
      CreateTaskUcDef.command({ title: 'Хлеб' }),
      owner,
      REQ,
    );

    expect(expectErr(res, 'OPERATION_NOT_FOUND').payload).toEqual({
      module: 'todo',
      uc: 'createTask',
    });
  });

  it('команда UC чужого модуля — ошибка компиляции', async () => {
    const { app, usersModule, todoModule } = makeApp();
    const api = new ApiApp(app, [usersModule, todoModule]);

    const res = await api.dispatch(
      UsersModuleDef,
      // @ts-expect-error createTask не из модуля users
      CreateTaskUcDef.command({ title: 'Хлеб' }),
      owner,
      REQ,
    );

    expectErr(res, 'OPERATION_NOT_FOUND');
  });
});

describe('ApiApp.runJob', () => {
  it('прогоняет Job модуля', async () => {
    const { app, tasks, usersModule, todoModule } = makeApp();
    const api = new ApiApp(app, [usersModule, todoModule]);
    const taskId = await createTask(api);
    expectOk(
      await api.dispatch(
        TodoModuleDef,
        CompleteTaskUcDef.command({ taskId }),
        owner,
        REQ,
      ),
    );

    const report = await api.runJob(
      TodoModuleDef,
      ArchiveDoneTasksJobDef,
      Trace.forJob(ArchiveDoneTasksJobDef),
    );

    expect(expectOk(report)).toEqual({ processed: 1, failed: 0 });
    expect((await tasks.findById(taskId))?.isArchived()).toBe(true);
  });

  it('модуль не подключён — исключение', async () => {
    const { app, usersModule } = makeApp();
    const api = new ApiApp(app, [usersModule]);

    await expect(
      api.runJob(
        TodoModuleDef,
        ArchiveDoneTasksJobDef,
        Trace.forJob(ArchiveDoneTasksJobDef),
      ),
    ).rejects.toThrow('Модуль todo не подключён к приложению');
  });
});

describe('ApiApp.subscribe', () => {
  const removed = (api: ApiApp<ExampleUser>, userId: string) =>
    api.dispatch(
      UsersModuleDef,
      RemoveUserUcDef.command({ userId }),
      adminPurge,
      REQ,
    );

  it('событие users доходит до реакции todo; отписка снимает все', async () => {
    const { app, bus, tasks, usersModule, todoModule } = makeApp();
    const api = new ApiApp(app, [usersModule, todoModule]);
    const mine = await createTask(api, owner);
    const theirs = await createTask(api, other);

    const off = api.subscribe();
    expectOk(await removed(api, OWNER));
    await bus.delivered();
    off();
    expectOk(await removed(api, OTHER));
    await bus.delivered();

    expect((await tasks.findById(mine))?.isArchived()).toBe(true);
    expect((await tasks.findById(theirs))?.isArchived()).toBe(false);
  });

  it('без подписки событие никого не будит', async () => {
    const { app, bus, tasks, usersModule, todoModule } = makeApp();
    const api = new ApiApp(app, [usersModule, todoModule]);
    const taskId = await createTask(api);

    expectOk(await removed(api, OWNER));
    await bus.delivered();

    expect(bus.published.map((e: EventEnvelope) => e.name)).toContain(
      'users.user.removed',
    );
    expect((await tasks.findById(taskId))?.isArchived()).toBe(false);
  });
});
