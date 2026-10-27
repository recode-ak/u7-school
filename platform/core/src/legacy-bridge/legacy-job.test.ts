import { beforeEach, describe, expect, test } from 'bun:test';
import {
  type DomainError,
  type Identified,
  ModuleDef,
  ok,
  type Result,
} from 'dmg-core';
import {
  JobFromDef,
  type JobReport,
  type JobRun,
  type ModuleDeps,
  ModuleFacades,
  ModuleFromDef,
  type UnitOfWork,
} from 'dmg-core/app';
import {
  MemoryTasks,
  T0,
  TASK,
  taskRow,
  testAppContext,
} from 'dmg-core/testing';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  TaskArDef,
} from 'dmg-core/testing/example/todo/index';
import { InProcJobExecutor } from '../infra/in-proc-job-executor';
import { legacyJob, legacyJobsOf } from './legacy-job';

/** Модуль с одним Job — мост работает через модуль, а не через Job. */
const ArchiveModuleDef = ModuleDef.define({
  name: 'archive',
  label: 'Архив',
  description: 'Модуль для проверки моста планировщика.',
  dependsOn: [],
  aggregates: [TaskArDef],
  useCases: [],
  reactions: [],
  jobs: [ArchiveDoneTasksJobDef],
});

type Deps = ModuleDeps & { readonly tasks: MemoryTasks };

class ArchiveDoneTasks extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps, module: typeof ArchiveModuleDef) {
    super(ArchiveDoneTasksJobDef, deps, module);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    return job.forEach(
      await this.resolve.tasks.findDone(),
      async (
        task: TaskAr,
        uow: UnitOfWork,
      ): Promise<Result<void, DomainError>> => {
        const res = task.archive(this.now());
        if (!res.ok) return res;
        uow.register(task, this.resolve.tasks);
        return ok();
      },
    );
  }
}

let tasks: MemoryTasks;
let module: ModuleFromDef<typeof ArchiveModuleDef, Deps, Identified>;
const job = () => legacyJob(module, ArchiveDoneTasksJobDef);

beforeEach(() => {
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK, 'done'));
  module = new ModuleFromDef<typeof ArchiveModuleDef, Deps, Identified>(
    ArchiveModuleDef,
    {
      useCases: {},
      reactions: {},
      jobs: { archiveDoneTasks: ArchiveDoneTasks },
    },
    {
      app: testAppContext({ at: T0 }).app,
      facades: new ModuleFacades(),
      tasks,
    },
  );
});

describe('legacyJob', () => {
  test('несёт имя, метку и расписание из Def', () => {
    const legacy = job();
    expect([legacy.jobName, legacy.jobLabel, legacy.schedule]).toEqual([
      'archiveDoneTasks',
      'Архивировать выполненные задачи',
      { kind: 'dailyAt', hour: 3, minute: 0 },
    ]);
  });

  test('исполняется legacy-исполнителем планировщика', async () => {
    await new InProcJobExecutor().execute(job());
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
  });

  test('сбой прогона виден планировщику как исключение', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    await expect(job().execute()).rejects.toThrow('SERVER_INTERNAL');
  });

  test('задания модуля отдаются списком', () => {
    expect(legacyJobsOf(module).map((j) => j.jobName)).toEqual([
      'archiveDoneTasks',
    ]);
  });
});
