import { beforeEach, describe, expect, test } from 'bun:test';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import { SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import { testAppContext } from '#core/testing/app-context';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  TaskEvents,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { UsersModuleDef } from '#core/testing/example/users/index';
import { expectErr, expectOk } from '#core/testing/index';
import { MemoryTasks, T0, TASK, TASK_2, taskRow } from '../app.fixture';
import type { ModuleDeps } from '../context';
import { ModuleFacades } from '../facade/module-facades';
import { jobTrace, type Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { JobFromDef, type JobReport, type JobRun } from './job-from-def';

type Deps = ModuleDeps & { readonly tasks: MemoryTasks };
/** Модули без зависимостей — фасадов нет. */
const facades = new ModuleFacades();

class ArchiveDoneTasks extends JobFromDef<typeof ArchiveDoneTasksJobDef, Deps> {
  constructor(deps: Deps, module: AnyModuleDef = TodoModuleDef) {
    super(ArchiveDoneTasksJobDef, deps, module);
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
/** След прогона — его передаёт вызывающий (модуль, планировщик). */
let run: Trace;

beforeEach(() => {
  ctx = testAppContext({ at: T0 });
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK, 'done'));
  tasks.rows.set(TASK_2, taskRow(TASK_2, 'done'));
  job = new ArchiveDoneTasks({ app: ctx.app, facades, tasks });
  run = jobTrace();
});

describe('JobFromDef.handle', () => {
  test('обход: каждая запись фиксируется и публикует события', async () => {
    expect(expectOk(await job.handle(run))).toEqual({
      processed: 2,
      failed: 0,
    });
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
    expect(ctx.published.map((e) => e.name)).toEqual([
      TaskEvents.archived.name,
      TaskEvents.archived.name,
    ]);
    // Вызывающий — в записи прогона в логе операций, не в конверте (Р7).
    expect(ctx.published[0]).not.toHaveProperty('caller');
    expect(ctx.oplog.records[0]?.caller).toEqual(
      new SystemCaller(job.ref).toLog(),
    );
  });

  test('след вызывающего — причина и correlationId всех событий прогона', async () => {
    await job.handle(run);
    expect(job.runs).toEqual([run]);
    const traces = ctx.published.map(({ cause, correlationId }) => ({
      cause,
      correlationId,
    }));
    expect(traces).toEqual([run, run]);
  });

  test('ref — вид, модуль и имя задания', () => {
    expect(job.ref).toEqual({
      kind: 'job',
      module: 'todo',
      name: 'archiveDoneTasks',
    });
  });

  test('Job не из модуля — исключение сборки', () => {
    expect(
      () =>
        new ArchiveDoneTasks({ app: ctx.app, facades, tasks }, UsersModuleDef),
    ).toThrow('Job archiveDoneTasks не входит в модуль users');
  });

  test('сбой одной записи не прерывает обход и пишется в лог', async () => {
    const archive = job.step;
    job.step = async (task, uow) => {
      if (task.uuid === TASK) throw new Error('диск недоступен');
      return archive(task, uow);
    };
    expect(expectOk(await job.handle(run))).toEqual({
      processed: 1,
      failed: 1,
    });
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
    expect(expectOk(await job.handle(run))).toEqual({
      processed: 1,
      failed: 1,
    });
    expect(tasks.rows.get(TASK)?.status).toBe('done');
    expect(tasks.rows.get(TASK_2)?.status).toBe('archived');
  });

  test('сбой загрузки → SERVER_INTERNAL и запись в лог', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    expectErr(await job.handle(run), 'SERVER_INTERNAL');
    expect(ctx.logs).toHaveLength(1);
  });
});

describe('JobFromDef — лог операций (D-43, Р6)', () => {
  test('прогон — одна запись: отчёт и события всех записей', async () => {
    const report = expectOk(await job.handle(run));
    expect(ctx.oplog.records).toEqual([
      {
        at: T0,
        module: 'todo',
        op: 'archiveDoneTasks',
        kind: 'job',
        caller: { kind: 'system', from: job.ref },
        trace: run,
        input: null,
        result: { ok: true, output: report },
        events: ctx.published.map(({ name, eventId }) => ({ name, eventId })),
        durationMs: expect.any(Number),
      },
    ]);
    expect(ctx.oplog.records[0]?.events).toHaveLength(2);
  });

  test('сбой записи — в отчёте, события остальных — в записи', async () => {
    const archive = job.step;
    job.step = async (task, uow) => {
      if (task.uuid === TASK) throw new Error('диск недоступен');
      return archive(task, uow);
    };
    await job.handle(run);
    const [rec] = ctx.oplog.records;
    expect(rec?.result).toEqual({
      ok: true,
      output: { processed: 1, failed: 1 },
    });
    expect(rec?.events).toHaveLength(1);
  });

  test('сбой загрузки — запись SERVER_INTERNAL', async () => {
    tasks.findDone = async () => {
      throw new Error('диск недоступен');
    };
    await job.handle(run);
    expect(ctx.oplog.records).toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: 'SERVER_INTERNAL' }),
        }),
        events: [],
      }),
    ]);
  });
});
