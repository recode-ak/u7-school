import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Caller, SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import {
  ArchiveRemovedUserTasksErDef,
  TaskAr,
  TaskErrors,
  TaskEvents,
  TodoFacadeDef,
} from '#core/testing/example/todo/index';
import { UserArDef, UserEvents } from '#core/testing/example/users/index';
import {
  expectErr,
  expectOk,
  memoryBus,
  resetNow,
  setNow,
  testAppContext,
} from '#core/testing/index';
import { MemoryTasks, OWNER, T0, TASK, TASK_2, taskRow } from '../app.fixture';
import type { AppContext } from '../context';
import type { EnvelopeOf } from '../events/event-envelope';
import { implementFacade } from '../facade/implement-facade';
import type { Cause, Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { ReactionFromDef } from './reaction-from-def';

const ADMIN: Caller = { kind: 'user', user: { uuid: 'admin' } };

const removed = (): EnvelopeOf<typeof UserEvents.removed> => ({
  ...UserEvents.removed.make({ userId: OWNER }),
  eventId: 'e-removed',
  occurredAt: T0,
  aggregateId: OWNER,
  caller: ADMIN,
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

type Deps = {
  readonly app: AppContext;
  readonly tasks: MemoryTasks;
  readonly todo: ReturnType<typeof todoFacade>;
};

const todoFacade = () =>
  implementFacade(TodoFacadeDef, {
    getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
  });

class ArchiveRemovedUserTasks extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksErDef,
  Deps
> {
  /** Тесты подменяют шаг, чтобы получить нужный сбой или вызов. */
  step = async (
    event: EnvelopeOf<typeof UserEvents.removed>,
    uow: UnitOfWork,
    caller: SystemCaller<unknown>,
    deps: Deps,
  ): Promise<Result<void, DomainError>> => {
    this.seen = caller;
    for (const task of await deps.tasks.findByOwner(event.payload.userId)) {
      const res = task.archive();
      if (!res.ok) return res;
      uow.register(task, deps.tasks);
    }
    return ok();
  };
  seen: SystemCaller<unknown> | undefined;

  constructor(deps: Deps) {
    super(ArchiveRemovedUserTasksErDef, deps);
  }

  protected react(
    event: EnvelopeOf<typeof UserEvents.removed>,
    uow: UnitOfWork,
    caller: SystemCaller<unknown>,
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
  setNow(T0);
  ctx = testAppContext();
  tasks = new MemoryTasks();
  tasks.rows.set(TASK, taskRow(TASK));
  tasks.rows.set(TASK_2, taskRow(TASK_2, 'done'));
  er = new ArchiveRemovedUserTasks({ app: ctx.app, tasks, todo: todoFacade() });
});
afterEach(resetNow);

describe('ReactionFromDef.handle', () => {
  test('Ok → фиксация и события с причиной и system-вызывающим', async () => {
    expectOk(await er.handle(removed()));
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
    const event: Cause = { kind: 'event', eventId: 'e-removed' };
    expect(
      ctx.published.map((e) => [e.name, e.cause, e.correlationId]),
    ).toEqual([
      [TaskEvents.archived.name, event, 'c-1'],
      [TaskEvents.archived.name, event, 'c-1'],
    ]);
    expect(ctx.published[0]?.caller).toEqual({
      kind: 'system',
      source: 'archiveRemovedUserTasks',
      onBehalfOf: ADMIN,
    });
  });

  test('для вызова UC — system от имени автора и след цепочки', async () => {
    await er.handle(removed());
    expect(er.seen?.onBehalfOf).toEqual(ADMIN);
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

  test('фасад вне calls → SERVER_INTERNAL', async () => {
    er.step = async (_e, _uow, _caller, deps) => {
      await deps.todo.getTask(TASK);
      return ok();
    };
    expectErr(await er.handle(removed()), 'SERVER_INTERNAL');
  });
});

describe('ReactionFromDef — production', () => {
  test('фасад вне calls и агрегат вне touches — warn, реакция проходит', async () => {
    const prod = testAppContext('production');
    er = new ArchiveRemovedUserTasks({
      app: prod.app,
      tasks,
      todo: todoFacade(),
    });
    er.step = async (_e, uow, _caller, deps) => {
      await deps.todo.getTask(TASK);
      const task = TaskAr.restore(taskRow(TASK));
      uow.register(task, { aggregate: UserArDef, save: async () => {} });
      return ok();
    };
    expectOk(await er.handle(removed()));
    expect(prod.logs.map((l) => [l.level, l.message])).toEqual([
      ['warn', 'archiveRemovedUserTasks: фасад todo не заявлен в calls'],
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
