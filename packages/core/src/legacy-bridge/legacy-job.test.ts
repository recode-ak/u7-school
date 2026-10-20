import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type DomainError,
  JobFromDef,
  type JobReport,
  type JobRun,
  ok,
  type Result,
  type UnitOfWork,
} from 'dmg-core';
import {
  MemoryTasks,
  resetNow,
  setNow,
  T0,
  TASK,
  taskRow,
  testAppContext,
} from 'dmg-core/testing';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
} from 'dmg-core/testing/example/todo/index';
import { InProcJobExecutor } from '../infra/in-proc-job-executor';
import { legacyJob, legacyJobsOf } from './legacy-job';

type Deps = {
  readonly app: ReturnType<typeof testAppContext>['app'];
  readonly tasks: MemoryTasks;
};

class ArchiveDoneTasks extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJobDef, deps);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    return job.forEach(
      await this.resolve.tasks.findDone(),
      async (
        task: TaskAr,
        uow: UnitOfWork,
      ): Promise<Result<void, DomainError>> => {
        const res = task.archive();
        if (!res.ok) return res;
        uow.register(task, this.resolve.tasks);
        return ok();
      },
    );
  }
}

let tasks: MemoryTasks;
let job: ArchiveDoneTasks;

beforeEach(() => {
  setNow(T0);
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK, 'done'));
  job = new ArchiveDoneTasks({ app: testAppContext().app, tasks });
});
afterEach(resetNow);

describe('legacyJob', () => {
  test('несёт имя, метку и расписание из Def', () => {
    const legacy = legacyJob(job);
    expect([legacy.jobName, legacy.jobLabel, legacy.schedule]).toEqual([
      'archiveDoneTasks',
      'Архивировать выполненные задачи',
      { kind: 'dailyAt', hour: 3, minute: 0 },
    ]);
  });

  test('исполняется legacy-исполнителем планировщика', async () => {
    await new InProcJobExecutor().execute(legacyJob(job));
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
  });

  test('сбой прогона виден планировщику как исключение', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    await expect(legacyJob(job).execute()).rejects.toThrow('SERVER_INTERNAL');
  });

  test('задания модуля отдаются списком', () => {
    expect(legacyJobsOf({ jobs: [job] }).map((j) => j.jobName)).toEqual([
      'archiveDoneTasks',
    ]);
  });
});
