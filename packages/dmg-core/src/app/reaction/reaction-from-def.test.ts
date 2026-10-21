import { beforeEach, describe, expect, test } from 'bun:test';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import { SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import {
  ArchiveRemovedUserTasksErDef,
  TaskAr,
  TaskEvents,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import {
  UserArDef,
  UserEvents,
  UsersModuleDef,
} from '#core/testing/example/users/index';
import {
  expectErr,
  expectOk,
  memoryBus,
  testAppContext,
} from '#core/testing/index';
import { MemoryTasks, OWNER, T0, TASK, TASK_2, taskRow } from '../app.fixture';
import type { ModuleDeps } from '../context';
import type { EnvelopeOf } from '../events/event-envelope';
import { ModuleFacades } from '../facade/module-facades';
import type { Cause, Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { ReactionFromDef } from './reaction-from-def';

const removed = (): EnvelopeOf<typeof UserEvents.removed> => ({
  ...UserEvents.removed.make({ userId: OWNER }),
  eventId: 'e-removed',
  occurredAt: T0,
  aggregateId: OWNER,
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

type Deps = ModuleDeps & { readonly tasks: MemoryTasks };
/** Модули без зависимостей — фасадов нет. */
const facades = new ModuleFacades();

class ArchiveRemovedUserTasks extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksErDef,
  Deps
> {
  /** Тесты подменяют шаг, чтобы получить нужный сбой или вызов. */
  step = async (
    event: EnvelopeOf<typeof UserEvents.removed>,
    uow: UnitOfWork,
    caller: SystemCaller,
    deps: Deps,
  ): Promise<Result<void, DomainError>> => {
    this.seen = caller;
    for (const task of await deps.tasks.findByOwner(event.payload.userId)) {
      const res = task.archive(this.now());
      if (!res.ok) return res;
      uow.register(task, deps.tasks);
    }
    return ok();
  };
  seen: SystemCaller | undefined;

  constructor(deps: Deps, module: AnyModuleDef = TodoModuleDef) {
    super(ArchiveRemovedUserTasksErDef, deps, module);
  }

  protected react(
    event: EnvelopeOf<typeof UserEvents.removed>,
    uow: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    this.seenTrace = trace;
    return this.step(event, uow, caller, this.resolve);
  }
  seenTrace: Trace | undefined;
}

let ctx: ReturnType<typeof testAppContext>;
let tasks: MemoryTasks;
let er: ArchiveRemovedUserTasks;

beforeEach(() => {
  ctx = testAppContext({ at: T0 });
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK));
  tasks.rows.set(TASK_2, taskRow(TASK_2, 'done'));
  er = new ArchiveRemovedUserTasks({ app: ctx.app, facades, tasks });
});

describe('ReactionFromDef.handle', () => {
  test('Ok → фиксация и события с причиной и SystemCaller реакции', async () => {
    expectOk(await er.handle(removed()));
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
    const event: Cause = { kind: 'event', eventId: 'e-removed' };
    expect(
      ctx.published.map((e) => [e.name, e.cause, e.correlationId]),
    ).toEqual([
      [TaskEvents.archived.name, event, 'c-1'],
      [TaskEvents.archived.name, event, 'c-1'],
    ]);
    // Вызывающий — в записи реакции в логе операций, не в конверте (Р7).
    expect(ctx.published[0]).not.toHaveProperty('caller');
    expect(ctx.oplog.records[0]?.caller).toEqual(
      new SystemCaller(er.ref).toLog(),
    );
  });

  test('ref — вид, модуль и имя реакции', () => {
    expect(er.ref).toEqual({
      kind: 'eventReaction',
      module: 'todo',
      name: 'archiveRemovedUserTasks',
    });
  });

  test('ER не из модуля — исключение сборки', () => {
    expect(
      () =>
        new ArchiveRemovedUserTasks(
          { app: ctx.app, facades, tasks },
          UsersModuleDef,
        ),
    ).toThrow('ER archiveRemovedUserTasks не входит в модуль users');
  });

  test('для вызова UC — SystemCaller без человека (D-43) и след цепочки', async () => {
    await er.handle(removed());
    expect(er.seen).toEqual(new SystemCaller(er.ref));
    expect(er.seen?.person()).toBeUndefined();
    expect(er.seenTrace).toEqual({
      cause: { kind: 'event', eventId: 'e-removed' },
      correlationId: 'c-1',
    });
  });

  test('Err → без фиксации, запись в лог', async () => {
    tasks.rows.set(TASK, taskRow(TASK, 'archived'));
    expectErr(await er.handle(removed()), 'TASK_ARCHIVED');
    expect(tasks.rows.get(TASK_2)?.status).toBe('done');
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        source: 'archiveRemovedUserTasks',
      }),
    );
  });

  test('конфликт версии → VERSION_CONFLICT, событий нет, запись в лог', async () => {
    const archive = er.step;
    er.step = async (event, uow, caller, deps) => {
      const res = await archive(event, uow, caller, deps);
      const row = tasks.rows.get(TASK);
      if (row) tasks.rows.set(TASK, { ...row, version: row.version + 1 });
      return res;
    };
    expectErr(await er.handle(removed()), 'VERSION_CONFLICT');
    expect(ctx.published).toEqual([]);
    expect(ctx.logs.map((l) => l.level)).toEqual(['error']);
  });

  test('исключение → SERVER_INTERNAL и запись в лог', async () => {
    er.step = async () => {
      throw new Error('диск недоступен');
    };
    expectErr(await er.handle(removed()), 'SERVER_INTERNAL');
    expect(ctx.logs.map((l) => l.level)).toEqual(['error']);
  });

  test('агрегат вне touches → SERVER_INTERNAL', async () => {
    er.step = async (_e, uow) => {
      const task = TaskAr.restore(taskRow(TASK));
      uow.register(task, { aggregate: UserArDef, save: async () => {} });
      return ok();
    };
    expectErr(await er.handle(removed()), 'SERVER_INTERNAL');
  });
});

describe('ReactionFromDef — лог операций (D-43, Р6)', () => {
  test('успех: вход — событие, события реакции', async () => {
    expectOk(await er.handle(removed()));
    const event = removed();
    expect(ctx.oplog.records).toEqual([
      {
        at: T0,
        module: 'todo',
        op: 'archiveRemovedUserTasks',
        kind: 'eventReaction',
        caller: { kind: 'system', from: er.ref },
        trace: {
          cause: { kind: 'event', eventId: 'e-removed' },
          correlationId: 'c-1',
        },
        input: event,
        result: { ok: true, output: null },
        events: ctx.published.map(({ name, eventId }) => ({ name, eventId })),
        durationMs: expect.any(Number),
      },
    ]);
    expect(ctx.oplog.records[0]?.events).toHaveLength(2);
  });

  test('отказ — запись с ошибкой', async () => {
    tasks.rows.set(TASK, taskRow(TASK, 'archived'));
    const error = expectErr(await er.handle(removed()), 'TASK_ARCHIVED');
    expect(ctx.oplog.records).toEqual([
      expect.objectContaining({ result: { ok: false, error }, events: [] }),
    ]);
  });

  test('исключение — запись SERVER_INTERNAL', async () => {
    er.step = async () => {
      throw new Error('диск недоступен');
    };
    await er.handle(removed());
    expect(ctx.oplog.records[0]?.result).toMatchObject({
      ok: false,
      error: { code: 'SERVER_INTERNAL' },
    });
  });
});

describe('ReactionFromDef — production', () => {
  test('агрегат вне touches — warn, реакция проходит', async () => {
    const prod = testAppContext({ mode: 'production', at: T0 });
    er = new ArchiveRemovedUserTasks({ app: prod.app, facades, tasks });
    er.step = async (_e, uow) => {
      const task = TaskAr.restore(taskRow(TASK));
      uow.register(task, { aggregate: UserArDef, save: async () => {} });
      return ok();
    };
    expectOk(await er.handle(removed()));
    expect(prod.logs.map((l) => [l.level, l.message])).toEqual([
      ['warn', 'UoW: агрегат user не заявлен в touches'],
    ]);
  });
});

describe('ReactionFromDef.subscribe', () => {
  test('реагирует на событие из шины', async () => {
    const bus = memoryBus();
    er.subscribe(bus);
    bus.publish(removed());
    await new Promise((r) => setTimeout(r, 0));
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
  });
});
