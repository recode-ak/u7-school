import { beforeEach, describe, expect, test } from 'bun:test';
import { type Command, ModuleDef, ok, UserCaller } from 'dmg-core';
import {
  type CommandTransport,
  JobFromDef,
  type JobRun,
  ModuleApi,
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
  MemoryLogger,
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
  TodoModuleDef,
} from 'dmg-core/testing/example/todo/index';
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

describe('ApiApp.dispatch — команда модулю по его Def (D-49)', () => {
  test('модуль по адресу исполняет команду: Ok с выходом', async () => {
    const res = await app.dispatch(
      MiniModuleDef,
      CompleteTaskUcDef.command({ taskId: TASK }),
      user(OWNER),
      REQ,
    );
    expect(expectOk(res)).toEqual({});
  });

  test('команда после JSON исполняется: вход доходит до UC', async () => {
    tasks.rows.clear();
    const wire: Command<typeof CompleteTaskUcDef> = JSON.parse(
      JSON.stringify(CompleteTaskUcDef.command({ taskId: TASK })),
    );
    const res = await app.dispatch(MiniModuleDef, wire, user(OWNER), REQ);
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('модуль не подключён — OPERATION_NOT_FOUND с адресом', async () => {
    const res = await app.dispatch(
      TodoModuleDef,
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

  test('команда UC другого модуля — ошибка типа', () => {
    const wrong = () =>
      app.dispatch(
        MiniModuleDef,
        // @ts-expect-error createTask не из модуля mini
        CreateTaskUcDef.command({ title: 'x' }),
        user(OWNER),
        REQ,
      );
    expect(wrong).toBeFunction();
  });
});

describe('ModuleApi — клиент wire-транспорта (D-49)', () => {
  test('круговой путь JSON: команда → сервер → ответ → restore', async () => {
    tasks.rows.clear();
    // Сервер за транспортом: команда и ответ — через JSON, ответ
    // сериализован по Def UC.
    const wire: CommandTransport = {
      send: async (module, command) => {
        expect(module).toBe('mini');
        const received: Command<typeof CompleteTaskUcDef> = JSON.parse(
          JSON.stringify(command),
        );
        const res = await app.dispatch(
          MiniModuleDef,
          received,
          user(OWNER),
          REQ,
        );
        return JSON.parse(
          JSON.stringify(CompleteTaskUcDef.serializeResult(res)),
        );
      },
    };
    const api = new ModuleApi(MiniModuleDef, wire, new MemoryLogger());

    const res = await api.dispatch(
      CompleteTaskUcDef.command({ taskId: TASK }),
      user(OWNER),
      REQ,
    );

    expect(res).toEqual(TaskErrors.NOT_FOUND.err({ taskId: TASK }));
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
