import { beforeEach, describe, expect, test } from 'bun:test';
import { type Command, ModuleDef, ok, UserCaller } from 'dmg-core';
import {
  JobFromDef,
  type JobRun,
  type ModuleDeps,
  ModuleFacades,
  ModuleFromDef,
  Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  MemoryTasks,
  OWNER,
  TASK,
  taskRow,
  testAppContext,
} from 'dmg-core/testing';
import {
  ArchiveDoneTasksJobDef,
  CompleteTaskUcDef,
  CreateTaskUcDef,
  type TaskAr,
  TaskArDef,
  TaskErrors,
} from 'dmg-core/testing/example/todo/index';
import { AppException } from '../../domain/errors/errors';
import type { AppMeta } from '../../domain/types';
import type { Job } from '../job/job';
import { ApiApp } from './api-app';

const MiniModuleDef = ModuleDef.define({
  name: 'mini',
  label: 'Мини',
  description: 'DMG-модуль рядом с legacy в ApiApp.',
  dependsOn: [],
  aggregates: [TaskArDef],
  useCases: [CompleteTaskUcDef],
  reactions: [],
  jobs: [ArchiveDoneTasksJobDef],
});

type Deps = ModuleDeps & { readonly tasks: MemoryTasks };
type Loaded = { task: TaskAr };

class CompleteTask extends UseCaseFromDef<
  typeof CompleteTaskUcDef,
  Deps,
  Loaded
> {
  constructor(deps: Deps, module: typeof MiniModuleDef) {
    super(CompleteTaskUcDef, deps, module);
  }
  protected async load(input: { taskId: string }) {
    const task = await this.resolve.tasks.findById(input.taskId);
    return task ? ok({ task }) : TaskErrors.NOT_FOUND.err(input);
  }
  protected async execute(_: unknown, { task }: Loaded, uow: UnitOfWork) {
    const res = task.complete(this.now());
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok({});
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps, module: typeof MiniModuleDef) {
    super(ArchiveDoneTasksJobDef, deps, module);
  }
  protected run(job: JobRun) {
    return job.forEach([], async () => ok());
  }
}

const REQ = Trace.fromRequest({ requestId: 'r-1' });

type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
const user = (uuid: string) =>
  new UserCaller<User>({ uuid, hasRole: () => false });

let tasks: MemoryTasks;
let mini: ModuleFromDef<typeof MiniModuleDef, Deps, User>;
let app: ApiApp<AppMeta, User>;

beforeEach(() => {
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK));
  const deps = {
    app: testAppContext().app,
    facades: new ModuleFacades(),
    tasks,
  };
  mini = new ModuleFromDef<typeof MiniModuleDef, Deps, User>(
    MiniModuleDef,
    {
      useCases: { completeTask: CompleteTask },
      reactions: {},
      jobs: { archiveDoneTasks: ArchiveDone },
    },
    deps,
  );
  app = new ApiApp<AppMeta, User>([]).addDmgModules(mini);
});

describe('ApiApp.run — UC DMG', () => {
  test('возвращает Result: Ok с выходом', async () => {
    const res = await app.run(
      CompleteTaskUcDef,
      { taskId: TASK },
      user(OWNER),
      REQ,
    );
    expect(expectOk(res)).toEqual({});
  });

  test('возвращает Result: отказ — значение, не исключение', async () => {
    tasks.rows.clear();
    const res = await app.run(
      CompleteTaskUcDef,
      { taskId: TASK },
      user(OWNER),
      REQ,
    );
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('UC вне зарегистрированных модулей — исключение (баг сборки)', async () => {
    await expect(
      app.run(CreateTaskUcDef, { title: 'x' }, user(OWNER), REQ),
    ).rejects.toThrow('UC createTask не зарегистрирован');
  });
});

describe('ApiApp.dispatch — команда по адресу модуля (D-49)', () => {
  test('модуль по адресу исполняет команду: Ok с выходом', async () => {
    const res = await app.dispatch(
      'mini',
      CompleteTaskUcDef.command({ taskId: TASK }),
      user(OWNER),
      REQ,
    );
    expect(expectOk(res)).toEqual({});
  });

  test('команда после JSON исполняется: вход доходит до UC', async () => {
    tasks.rows.clear();
    const wire: Command = JSON.parse(
      JSON.stringify(CompleteTaskUcDef.command({ taskId: TASK })),
    );
    const res = await app.dispatch('mini', wire, user(OWNER), REQ);
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('неизвестный модуль — OPERATION_NOT_FOUND с адресом', async () => {
    const res = await app.dispatch(
      'todo',
      CompleteTaskUcDef.command({ taskId: TASK }),
      user(OWNER),
      REQ,
    );
    expect(expectErr(res, 'OPERATION_NOT_FOUND').payload).toEqual({
      module: 'todo',
      uc: 'completeTask',
    });
  });

  test('два модуля с одним именем — исключение сборки', () => {
    expect(() => app.addDmgModules(mini)).toThrow(
      'модуль DMG mini уже подключён',
    );
  });

  test('неизвестный UC в модуле — OPERATION_NOT_FOUND от модуля', async () => {
    const res = await app.dispatch(
      'mini',
      CreateTaskUcDef.command({ title: 'x' }),
      user(OWNER),
      REQ,
    );
    expect(expectErr(res, 'OPERATION_NOT_FOUND').payload).toEqual({
      module: 'mini',
      uc: 'createTask',
    });
  });
});

describe('ApiApp.execute — UC DMG', () => {
  test('Ok — возвращает выход', async () => {
    expect(
      await app.execute(CompleteTaskUcDef, { taskId: TASK }, user(OWNER), REQ),
    ).toEqual({});
  });

  test('Err — AppException с кодом и legacy-kind', async () => {
    tasks.rows.clear();
    const error = await app
      .execute(CompleteTaskUcDef, { taskId: TASK }, user(OWNER), REQ)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect(error instanceof AppException && error.error).toMatchObject({
      name: 'TASK_NOT_FOUND',
      kind: 'not-found',
      message: 'Задача не найдена',
    });
  });

  test('ACCESS_DENIED — текст отказа правила в message', async () => {
    const error = await app
      .execute(CompleteTaskUcDef, { taskId: TASK }, user('чужой'), REQ)
      .catch((e: unknown) => e);
    expect(error instanceof AppException && error.error).toMatchObject({
      name: 'ACCESS_DENIED',
      kind: 'access-denied',
      message: 'Управлять задачей может владелец или администратор.',
    });
  });
});

describe('ApiApp.start — задания DMG рядом с legacy', () => {
  test('планировщик получает задания модулей DMG', () => {
    const started: string[] = [];
    app.init({
      start: (jobs: readonly Job[]) => {
        started.push(...jobs.map((j) => j.jobName));
      },
      stop: () => {},
    });
    app.start();
    expect(started).toEqual(['archiveDoneTasks']);
  });
});
