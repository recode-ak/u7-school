import { beforeEach, describe, expect, test } from 'bun:test';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import { testAppContext } from '#core/testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  TaskEvents,
} from '#core/testing/example/todo/index';
import { expectErr, expectOk } from '#core/testing/index';
import { MemoryTasks, T0, TASK, TASK_2, taskRow } from '../app.fixture';
import type { AppContext } from '../context';
import type { Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { JobFromDef, type JobReport, type JobRun } from './job-from-def';

type Deps = { readonly app: AppContext; readonly tasks: MemoryTasks };

class ArchiveDoneTasks extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps) {
    super(ArchiveDoneTasksJobDef, deps);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    this.runs.push(job.trace);
    return job.forEach(await this.resolve.tasks.findDone(), this.step);
  }

  /** Шаг по одной задаче; тесты подменяют его, чтобы получить сбой. */
  readonly runs: Trace[] = [];

  step = async (
    task: TaskAr,
    uow: UnitOfWork,
  ): Promise<Result<void, DomainError>> => {
    const res = task.archive(this.now());
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok();
  };
}

let ctx: ReturnType<typeof testAppContext>;
let tasks: MemoryTasks;
let job: ArchiveDoneTasks;

beforeEach(() => {
  ctx = testAppContext({ at: T0 });
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK, 'done'));
  tasks.rows.set(TASK_2, taskRow(TASK_2, 'done'));
  job = new ArchiveDoneTasks({ app: ctx.app, tasks });
});

describe('JobFromDef.handle', () => {
  test('обход: каждая запись фиксируется и публикует события', async () => {
    expect(expectOk(await job.handle())).toEqual({ processed: 2, failed: 0 });
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
    expect(ctx.published.map((e) => e.name)).toEqual([
      TaskEvents.archived.name,
      TaskEvents.archived.name,
    ]);
    expect(ctx.published[0]?.caller).toEqual({
      kind: 'system',
      source: 'archiveDoneTasks',
    });
  });

  test('прогон — причина и correlationId всех его событий', async () => {
    await job.handle();
    const [run] = job.runs;
    if (run === undefined) throw new Error('прогона не было');
    expect(run.cause.kind).toBe('job');
    const traces = ctx.published.map(({ cause, correlationId }) => ({
      cause,
      correlationId,
    }));
    expect(traces).toEqual([run, run]);
  });

  test('у каждого прогона свой runId', async () => {
    await job.handle();
    await job.handle();
    const [a, b] = job.runs;
    expect(a?.correlationId).not.toBe(b?.correlationId);
  });

  test('сбой одной записи не прерывает обход и пишется в лог', async () => {
    const archive = job.step;
    job.step = async (task, uow) => {
      if (task.uuid === TASK) throw new Error('диск недоступен');
      return archive(task, uow);
    };
    expect(expectOk(await job.handle())).toEqual({ processed: 1, failed: 1 });
    expect(tasks.rows.get(TASK_2)?.status).toBe('archived');
    expect(ctx.logs.map((l) => [l.level, l.source])).toEqual([
      ['error', 'archiveDoneTasks'],
    ]);
  });

  test('конфликт версии записи — сбой этой записи, обход продолжается', async () => {
    const archive = job.step;
    job.step = async (task, uow) => {
      const row = tasks.rows.get(task.uuid);
      if (task.uuid === TASK && row) {
        tasks.rows.set(TASK, { ...row, version: row.version + 1 });
      }
      return archive(task, uow);
    };
    expect(expectOk(await job.handle())).toEqual({ processed: 1, failed: 1 });
    expect(tasks.rows.get(TASK)?.status).toBe('done');
    expect(tasks.rows.get(TASK_2)?.status).toBe('archived');
  });

  test('сбой загрузки → SERVER_INTERNAL и запись в лог', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    expectErr(await job.handle(), 'SERVER_INTERNAL');
    expect(ctx.logs).toHaveLength(1);
  });
});
