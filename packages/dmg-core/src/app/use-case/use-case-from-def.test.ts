import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  test,
} from 'bun:test';
import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import type { Caller } from '#core/kernel/caller/caller';
import { defineErrors } from '#core/kernel/errors/define-errors';
import { ok } from '#core/kernel/result/result';
import {
  CompleteTaskUcDef,
  type TaskAr,
  TaskErrors,
  TaskEvents,
} from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/task/task.state';
import {
  expectErr,
  expectOk,
  resetNow,
  setNow,
  testAppContext,
} from '#core/testing/index';
import { MemoryTasks, OWNER, T0, TASK, taskRow } from '../app.fixture';
import type { AppContext } from '../context';
import { requestTrace, type Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { UseCaseFromDef } from './use-case-from-def';

const OtherErrors = defineErrors('OTHER', {
  FAILED: { kind: 'conflict', label: 'Сбой', description: 'Чужая ошибка.' },
});

type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
const user = (uuid: string): Caller<User> => ({
  kind: 'user',
  user: { uuid, hasRole: () => false },
});

type Deps = { readonly app: AppContext; readonly tasks: MemoryTasks };

const REQ: Trace = requestTrace({ requestId: 'r-1' });
type Loaded = { task: TaskAr };

async function loadTask(tasks: MemoryTasks, input: { taskId: string }) {
  const task = await tasks.findById(input.taskId);
  return task ? ok({ task }) : TaskErrors.NOT_FOUND.err({ taskId: TASK });
}

/** Эталонный UC: загрузить → (Policy в базе) → операция Ar → UoW. */
class CompleteTask extends UseCaseFromDef<
  typeof CompleteTaskUcDef,
  Deps,
  Loaded
> {
  constructor(deps: Deps) {
    super(CompleteTaskUcDef, deps);
  }

  protected load(input: { taskId: string }) {
    return loadTask(this.resolve.tasks, input);
  }

  protected async execute(
    _input: { taskId: string },
    { task }: Loaded,
    uow: UnitOfWork,
  ) {
    const res = this.mutate(task);
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok({});
  }

  /** Операция Ar; тесты подменяют её, чтобы получить нужный сбой. */
  mutate = (task: TaskAr) => task.complete();
}

let ctx: ReturnType<typeof testAppContext>;
let tasks: MemoryTasks;
let uc: CompleteTask;

function seed(status: TaskState['status'] = 'open'): void {
  tasks.rows.set(TASK, taskRow(TASK, status));
}

beforeEach(() => {
  setNow(T0);
  ctx = testAppContext();
  tasks = new MemoryTasks();
  uc = new CompleteTask({ app: ctx.app, tasks });
  seed();
});
afterEach(resetNow);

describe('UseCaseFromDef.handle — отказы до операции', () => {
  test('вид вызывающего не в callers → UNAUTHORIZED', async () => {
    const res = await uc.handle({ taskId: TASK }, { kind: 'guest' }, REQ);
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
  });

  test('невалидный вход → INPUT_VALIDATION с путём поля', async () => {
    const res = await uc.handle({ taskId: 'x' }, user(OWNER), REQ);
    const issues = expectErr(res, 'INPUT_VALIDATION').payload.issues;
    expect(issues.map((i) => i.path)).toEqual(['taskId']);
  });

  test('ошибка загрузки возвращается как есть', async () => {
    tasks.rows.clear();
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('отказ Policy → ACCESS_DENIED с правилом', async () => {
    const res = await uc.handle({ taskId: TASK }, user('чужой'), REQ);
    expect(expectErr(res, 'ACCESS_DENIED').payload.rule).toBe('canManage');
  });

  test('system из callers Policy не проверяет', async () => {
    const SystemUcDef = defineUseCase({
      ...CompleteTaskUcDef,
      callers: ['system'],
    });
    class SystemComplete extends UseCaseFromDef<
      typeof SystemUcDef,
      Deps,
      Loaded
    > {
      constructor() {
        super(SystemUcDef, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({});
    }
    const system: Caller<User> = { kind: 'system', source: 'test' };
    expectOk(await new SystemComplete().handle({ taskId: TASK }, system, REQ));
  });
});

describe('UseCaseFromDef.handle — операция', () => {
  test('Ok → сохранение, публикация, выход', async () => {
    expect(
      expectOk(await uc.handle({ taskId: TASK }, user(OWNER), REQ)),
    ).toEqual({});
    expect(tasks.rows.get(TASK)?.status).toBe('done');
    expect(ctx.published.map((e) => e.name)).toEqual([
      TaskEvents.completed.name,
    ]);
  });

  test('событие несёт след запроса: причина и correlationId', async () => {
    const trace = requestTrace({ requestId: 'r-1', correlationId: 'c-1' });
    await uc.handle({ taskId: TASK }, user(OWNER), trace);
    expect(ctx.published[0]).toMatchObject({
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'c-1',
    });
  });

  test('Err операции → без сохранения и публикации', async () => {
    seed('done');
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'TASK_ALREADY_DONE');
    expect(ctx.published).toEqual([]);
  });

  test('незаявленное событие в test → SERVER_INTERNAL, ничего не записано', async () => {
    uc.mutate = (task) => task.archive();
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'SERVER_INTERNAL');
    expect(tasks.rows.get(TASK)?.status).toBe('open');
  });

  test('незаявленное событие в production — warn, операция проходит', async () => {
    const prod = testAppContext('production');
    uc = new CompleteTask({ app: prod.app, tasks });
    uc.mutate = (task) => task.archive();
    expectOk(await uc.handle({ taskId: TASK }, user(OWNER), REQ));
    expect(prod.published.map((e) => e.name)).toEqual([
      TaskEvents.archived.name,
    ]);
    expect(prod.logs).toEqual([
      {
        level: 'warn',
        source: 'completeTask',
        message: 'UoW: событие todo.task.archived не заявлено в emits',
      },
    ]);
  });

  test('исключение → SERVER_INTERNAL и запись в лог', async () => {
    tasks.failOnFind = true;
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'SERVER_INTERNAL');
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'completeTask' }),
    );
  });

  test('невалидный выход → OUTPUT_VALIDATION', async () => {
    const BadOutputUcDef = defineUseCase({
      ...CompleteTaskUcDef,
      output: v.object({ taskId: v.pipe(v.string(), v.uuid()) }),
    });
    class BadOutput extends UseCaseFromDef<
      typeof BadOutputUcDef,
      Deps,
      Loaded
    > {
      constructor() {
        super(BadOutputUcDef, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({ taskId: 'не uuid' });
    }
    const res = await new BadOutput().handle(
      { taskId: TASK },
      user(OWNER),
      REQ,
    );
    expectErr(res, 'OUTPUT_VALIDATION');
  });
});

describe('UseCaseFromDef.subject', () => {
  const WhoAmIUcDef = defineUseCase({
    ...CompleteTaskUcDef,
    callers: ['user', 'system'],
  });
  class WhoAmI extends UseCaseFromDef<typeof WhoAmIUcDef, Deps, Loaded, User> {
    constructor() {
      super(WhoAmIUcDef, { app: ctx.app, tasks });
    }
    protected load = (i: { taskId: string }) => loadTask(tasks, i);
    protected execute = async (
      _: unknown,
      __: Loaded,
      ___: UnitOfWork,
      caller: Caller<User>,
    ) => {
      this.seen = this.subject(caller).uuid;
      return ok({});
    };
    seen: string | undefined;
  }

  test('субъект вызывающего — для реализации', async () => {
    const uc = new WhoAmI();
    expectOk(await uc.handle({ taskId: TASK }, user(OWNER), REQ));
    expect(uc.seen).toBe(OWNER);
  });

  test('без субъекта — баг callers: SERVER_INTERNAL', async () => {
    const res = await new WhoAmI().handle(
      { taskId: TASK },
      { kind: 'system', source: 'test' },
      REQ,
    );
    expectErr(res, 'SERVER_INTERNAL');
    expect(ctx.logs).toHaveLength(1);
  });
});

describe('UseCaseFromDef — типы', () => {
  test('execute не может вернуть незаявленную ошибку (ERR-02)', () => {
    class Undeclared extends UseCaseFromDef<
      typeof CompleteTaskUcDef,
      Deps,
      Loaded
    > {
      constructor() {
        super(CompleteTaskUcDef, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      // @ts-expect-error: OTHER_FAILED нет в errors CompleteTaskUcDef
      protected execute = async () => OtherErrors.FAILED.err();
    }
    expect(Undeclared).toBeDefined();
  });

  test('загруженный контекст обязан подходить Policy', () => {
    type Uc = typeof CompleteTaskUcDef;
    // @ts-expect-error: { title } не TaskCtx — Policy нечего проверять
    type WrongCtx = UseCaseFromDef<Uc, Deps, { title: string }>;
    expectTypeOf<WrongCtx>().not.toBeNever();
  });
});
