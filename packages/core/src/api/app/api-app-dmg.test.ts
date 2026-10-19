import { beforeEach, describe, expect, test } from 'bun:test';
import { MemoryTasks, OWNER, TASK, taskRow } from '../../dmg/app/app.fixture';
import type { AppContext } from '../../dmg/app/context';
import { JobFromDef } from '../../dmg/app/job/job-from-def';
import { ModuleFromDef } from '../../dmg/app/module/module-from-def';
import type { UnitOfWork } from '../../dmg/app/uow/unit-of-work';
import { UseCaseFromDef } from '../../dmg/app/use-case/use-case-from-def';
import { defineModule } from '../../dmg/domain/contracts/define-module';
import type { Caller } from '../../dmg/kernel/caller/caller';
import { ok } from '../../dmg/kernel/result/result';
import { expectErr, expectOk, testAppContext } from '../../dmg/testing';
import {
  ArchiveDoneTasksJob,
  CompleteTaskUc,
  CreateTaskUc,
  type TaskAr,
  TaskErrors,
} from '../../dmg/testing/example/todo';
import { AppException } from '../../domain/errors/errors';
import type { AppMeta } from '../../domain/types';
import type { Job } from '../job/job';
import { ApiApp } from './api-app';

const MiniModule = defineModule({
  name: 'mini',
  label: 'Мини',
  description: 'DMG-модуль рядом с legacy в ApiApp.',
  dependsOn: [],
  aggregates: [],
  useCases: [CompleteTaskUc],
  reactions: [],
  jobs: [ArchiveDoneTasksJob],
});

type Deps = { readonly app: AppContext; readonly tasks: MemoryTasks };
type Loaded = { task: TaskAr };

class CompleteTask extends UseCaseFromDef<typeof CompleteTaskUc, Deps, Loaded> {
  constructor(deps: Deps) {
    super(CompleteTaskUc, deps);
  }
  protected async load(input: { taskId: string }) {
    const task = await this.resolve.tasks.findById(input.taskId);
    return task ? ok({ task }) : TaskErrors.NOT_FOUND.err(input);
  }
  protected async execute(_: unknown, { task }: Loaded, uow: UnitOfWork) {
    const res = task.complete();
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok({});
  }
}

class ArchiveDone extends JobFromDef<typeof ArchiveDoneTasksJob, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJob, deps);
  }
  protected run = () => this.forEach([], async () => ok());
}

type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
const user = (uuid: string): Caller<User> => ({
  kind: 'user',
  user: { uuid, hasRole: () => false },
});

let tasks: MemoryTasks;
let app: ApiApp<AppMeta>;

beforeEach(() => {
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK));
  const deps = { app: testAppContext().app, tasks };
  const mini = new ModuleFromDef(
    MiniModule,
    {
      useCases: { completeTask: CompleteTask },
      reactions: {},
      jobs: { archiveDoneTasks: ArchiveDone },
    },
    deps,
  );
  app = new ApiApp<AppMeta>([]).addDmgModules(mini);
});

describe('ApiApp.run — UC DMG', () => {
  test('возвращает Result: Ok с выходом', async () => {
    const res = await app.run(CompleteTaskUc, { taskId: TASK }, user(OWNER));
    expect(expectOk(res)).toEqual({});
  });

  test('возвращает Result: отказ — значение, не исключение', async () => {
    tasks.rows.clear();
    const res = await app.run(CompleteTaskUc, { taskId: TASK }, user(OWNER));
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('UC вне зарегистрированных модулей — исключение (баг сборки)', async () => {
    await expect(
      app.run(CreateTaskUc, { title: 'x' }, user(OWNER)),
    ).rejects.toThrow('UC createTask не зарегистрирован');
  });
});

describe('ApiApp.execute — UC DMG', () => {
  test('Ok — возвращает выход', async () => {
    expect(
      await app.execute(CompleteTaskUc, { taskId: TASK }, user(OWNER)),
    ).toEqual({});
  });

  test('Err — AppException с кодом и legacy-kind', async () => {
    tasks.rows.clear();
    const error = await app
      .execute(CompleteTaskUc, { taskId: TASK }, user(OWNER))
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
      .execute(CompleteTaskUc, { taskId: TASK }, user('чужой'))
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
