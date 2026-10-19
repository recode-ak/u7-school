import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { InProcEventBus } from '../../../infra/in-proc-event-bus';
import type { Caller, SystemCaller } from '../../kernel/caller/caller';
import type { DomainError } from '../../kernel/errors/error';
import { ok, type Result } from '../../kernel/result/result';
import {
  expectErr,
  expectOk,
  resetNow,
  setNow,
  testAppContext,
} from '../../testing';
import {
  ArchiveRemovedUserTasksEr,
  TaskAr,
  TaskErrors,
  TaskEvents,
  TodoFacade,
} from '../../testing/example/todo';
import { UserDef, UserEvents } from '../../testing/example/users/user/user.ar';
import { MemoryTasks, OWNER, T0, TASK, TASK_2, taskRow } from '../app.fixture';
import type { AppContext } from '../context';
import type { EnvelopeOf } from '../events/event-envelope';
import { legacyEventBus } from '../events/legacy-event-bus';
import { implementFacade } from '../facade/implement-facade';
import type { UnitOfWork } from '../uow/unit-of-work';
import { ReactionFromDef } from './reaction-from-def';

const ADMIN: Caller = { kind: 'user', user: { uuid: 'admin' } };

const removed = (): EnvelopeOf<typeof UserEvents.removed> => ({
  ...UserEvents.removed.make({ userId: OWNER }),
  eventId: 'e-removed',
  occurredAt: T0,
  aggregateId: OWNER,
  caller: ADMIN,
});

type Deps = {
  readonly app: AppContext;
  readonly tasks: MemoryTasks;
  readonly todo: ReturnType<typeof todoFacade>;
};

const todoFacade = () =>
  implementFacade(TodoFacade, {
    getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
  });

class ArchiveRemovedUserTasks extends ReactionFromDef<
  typeof ArchiveRemovedUserTasksEr,
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
    super(ArchiveRemovedUserTasksEr, deps);
  }

  protected react(
    event: EnvelopeOf<typeof UserEvents.removed>,
    uow: UnitOfWork,
    caller: SystemCaller<unknown>,
  ) {
    return this.step(event, uow, caller, this.resolve);
  }
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
    expect(ctx.published.map((e) => [e.name, e.causationId])).toEqual([
      [TaskEvents.archived.name, 'e-removed'],
      [TaskEvents.archived.name, 'e-removed'],
    ]);
    expect(ctx.published[0]?.caller).toEqual({
      kind: 'system',
      source: 'archiveRemovedUserTasks',
      onBehalfOf: ADMIN,
    });
  });

  test('вызывающий для UC — system от имени автора события', async () => {
    await er.handle(removed());
    expect(er.seen?.onBehalfOf).toEqual(ADMIN);
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
      uow.register(task, { aggregate: UserDef, save: async () => {} });
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

describe('ReactionFromDef.subscribe', () => {
  test('реагирует на событие из шины', async () => {
    const bus = legacyEventBus(new InProcEventBus());
    er.subscribe(bus);
    bus.publish(removed());
    await new Promise((r) => setTimeout(r, 0));
    expect(tasks.rows.get(TASK)?.status).toBe('archived');
  });
});
