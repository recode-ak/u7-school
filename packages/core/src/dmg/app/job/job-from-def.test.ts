import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DomainError } from '#dmg/kernel/errors/error';
import { ok, type Result } from '#dmg/kernel/result/result';
import { testAppContext } from '#dmg/testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  TaskEvents,
} from '#dmg/testing/example/todo/index';
import { expectErr, expectOk, resetNow, setNow } from '#dmg/testing/index';
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
    const res = task.archive();
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok();
  };
}

let ctx: ReturnType<typeof testAppContext>;
let tasks: MemoryTasks;
let job: ArchiveDoneTasks;

beforeEach(() => {
  setNow(T0);
  ctx = testAppContext();
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK, 'done'));
  tasks.rows.set(TASK_2, taskRow(TASK_2, 'done'));
  job = new ArchiveDoneTasks({ app: ctx.app, tasks });
});
afterEach(resetNow);

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

  test('сбой загрузки → SERVER_INTERNAL и запись в лог', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    expectErr(await job.handle(), 'SERVER_INTERNAL');
    expect(ctx.logs).toHaveLength(1);
  });
});
