import { beforeEach, describe, expect, expectTypeOf, test } from 'bun:test';
import * as v from 'valibot';
import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import {
  type AnyModuleDef,
  defineModule,
} from '#core/domain/contracts/define-module';
import {
  type AnyUseCaseDef,
  defineUseCase,
} from '#core/domain/contracts/define-use-case';
import { domainRule } from '#core/domain/rules/domain-rule';
import type { CallContext } from '#core/kernel/caller/call-context';
import {
  type Caller,
  GuestCaller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { defineErrors } from '#core/kernel/errors/define-errors';
import { ok } from '#core/kernel/result/result';
import {
  CompleteTaskUcDef,
  type TaskAr,
  TaskErrors,
  TaskEvents,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/task/task.state';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { MemoryTasks, OWNER, T0, TASK, taskRow } from '../app.fixture';

const T1 = T0 + 60_000;

import type { AppContext } from '../context';
import { requestTrace, type Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { UseCaseFromDef } from './use-case-from-def';

const OtherErrors = defineErrors('OTHER', {
  FAILED: { kind: 'conflict', label: 'Сбой', description: 'Чужая ошибка.' },
});

type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
const user = (uuid: string) =>
  new UserCaller<User>({ uuid, hasRole: () => false });
const JOB: OperationRef = { kind: 'job', module: 'todo', name: 'sweep' };
const system = new SystemCaller<User>(JOB);

/** Модуль-владелец UC теста — даёт `ref` реализации. */
const moduleOf = (...useCases: AnyUseCaseDef[]): AnyModuleDef =>
  defineModule({
    name: 'todo',
    label: 'Задачи',
    description: 'Модуль-владелец UC теста.',
    dependsOn: [],
    aggregates: [],
    useCases,
    reactions: [],
    jobs: [],
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
    super(CompleteTaskUcDef, deps, TodoModuleDef);
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
  mutate = (task: TaskAr) => task.complete(this.now());
}

let ctx: ReturnType<typeof testAppContext>;
let tasks: MemoryTasks;
let uc: CompleteTask;

function seed(status: TaskState['status'] = 'open'): void {
  tasks.rows.set(TASK, taskRow(TASK, status));
}

beforeEach(() => {
  ctx = testAppContext({ at: T0 });
  tasks = new MemoryTasks();
  uc = new CompleteTask({ app: ctx.app, tasks });
  seed();
});

describe('UseCaseFromDef.handle — отказы до операции', () => {
  test('вид вызывающего не в callers → UNAUTHORIZED', async () => {
    const res = await uc.handle({ taskId: TASK }, new GuestCaller(), REQ);
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
        super(SystemUcDef, { app: ctx.app, tasks }, moduleOf(SystemUcDef));
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({});
    }
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
    uc.mutate = (task) => task.archive(T0);
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'SERVER_INTERNAL');
    expect(tasks.rows.get(TASK)?.status).toBe('open');
  });

  test('незаявленное событие в production — warn, операция проходит', async () => {
    const prod = testAppContext({ mode: 'production', at: T0 });
    uc = new CompleteTask({ app: prod.app, tasks });
    uc.mutate = (task) => task.archive(T0);
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

  test('невалидный выход → OUTPUT_VALIDATION до фиксации: ничего не сохранено и не опубликовано', async () => {
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
        super(
          BadOutputUcDef,
          { app: ctx.app, tasks },
          moduleOf(BadOutputUcDef),
        );
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async (
        _: unknown,
        { task }: Loaded,
        uow: UnitOfWork,
      ) => {
        task.complete(T0);
        uow.register(task, tasks);
        return ok({ taskId: 'не uuid' });
      };
    }
    const res = await new BadOutput().handle(
      { taskId: TASK },
      user(OWNER),
      REQ,
    );
    expectErr(res, 'OUTPUT_VALIDATION');
    expect(tasks.rows.get(TASK)?.status).toBe('open');
    expect(ctx.published).toEqual([]);
  });
});

describe('UseCaseFromDef — параллельное изменение', () => {
  test('запись изменили после загрузки → VERSION_CONFLICT, событий нет', async () => {
    uc.mutate = (task) => {
      const row = tasks.rows.get(TASK);
      if (row) tasks.rows.set(TASK, { ...row, version: row.version + 1 });
      return task.complete(T0);
    };
    const res = await uc.handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'VERSION_CONFLICT');
    expect(tasks.rows.get(TASK)?.status).toBe('open');
    expect(ctx.published).toEqual([]);
  });
});

describe('UseCaseFromDef — время операции', () => {
  test('момент операции и событий — из часов приложения', async () => {
    ctx.setNow(T1);
    expectOk(await uc.handle({ taskId: TASK }, user(OWNER), REQ));
    expect(tasks.rows.get(TASK)?.completedAt).toBe(T1);
    expect(ctx.published.map((e) => e.occurredAt)).toEqual([T1]);
  });
});

describe('UseCaseFromDef — ref', () => {
  test('ref — вид, модуль и имя UC', () => {
    expect(uc.ref).toEqual({
      kind: 'useCase',
      module: 'todo',
      name: 'completeTask',
    });
  });

  test('UC не из модуля — исключение сборки', () => {
    class Alien extends UseCaseFromDef<typeof CompleteTaskUcDef, Deps, Loaded> {
      constructor() {
        super(CompleteTaskUcDef, { app: ctx.app, tasks }, moduleOf());
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({});
    }
    expect(() => new Alien()).toThrow(
      'UC completeTask не входит в модуль todo',
    );
  });
});

describe('UseCaseFromDef — вызывающий system (D-43)', () => {
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
      super(SystemUcDef, { app: ctx.app, tasks }, moduleOf(SystemUcDef));
    }
    protected load = (i: { taskId: string }) => loadTask(tasks, i);
    protected execute = async () => ok({});
  }
  const from: OperationRef = {
    kind: 'useCase',
    module: 'notes',
    name: 'notify',
  };

  test('system не в callers → UNAUTHORIZED, в том числе с человеком', async () => {
    const res = await uc.handle(
      { taskId: TASK },
      new SystemCaller(from, user(OWNER)),
      REQ,
    );
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  test('с человеком — Policy по субъекту человека', async () => {
    const uc = new SystemComplete();
    const own = new SystemCaller(from, user(OWNER));
    expectOk(await uc.handle({ taskId: TASK }, own, REQ));
    const alien = new SystemCaller(from, user('чужой'));
    const res = await uc.handle({ taskId: TASK }, alien, REQ);
    expect(expectErr(res, 'ACCESS_DENIED').payload.rule).toBe('canManage');
  });

  test('без человека (ER, Job) — Policy не проверяется', async () => {
    expectOk(await new SystemComplete().handle({ taskId: TASK }, system, REQ));
  });

  test('с гостем — Policy по субъекту, которого нет: ACCESS_DENIED', async () => {
    const viaGuest = new SystemCaller<User>(from, new GuestCaller());
    const res = await new SystemComplete().handle(
      { taskId: TASK },
      viaGuest,
      REQ,
    );
    expectErr(res, 'ACCESS_DENIED');
  });
});

describe('UseCaseFromDef.callContext', () => {
  const CallerUcDef = defineUseCase({
    ...CompleteTaskUcDef,
    callers: ['user'],
  });
  class Calling extends UseCaseFromDef<typeof CallerUcDef, Deps, Loaded, User> {
    constructor() {
      super(CallerUcDef, { app: ctx.app, tasks }, moduleOf(CallerUcDef));
    }
    protected load = (
      i: { taskId: string },
      caller: Caller<User>,
      trace: Trace,
    ) => {
      this.loaded = this.callContext(caller, trace);
      return loadTask(tasks, i);
    };
    protected execute = async (
      _: unknown,
      __: Loaded,
      ___: UnitOfWork,
      caller: Caller<User>,
      trace: Trace,
    ) => {
      this.executed = this.callContext(caller, trace);
      return ok({});
    };
    loaded: CallContext | undefined;
    executed: CallContext | undefined;
  }

  test('load и execute получают след; контекст — SystemCaller UC с человеком, calls, след', async () => {
    const uc = new Calling();
    const caller = user(OWNER);
    expectOk(await uc.handle({ taskId: TASK }, caller, REQ));
    const expected: CallContext = {
      caller: new SystemCaller(uc.ref, caller),
      calls: [],
      trace: REQ,
    };
    expect(uc.loaded).toEqual(expected);
    expect(uc.executed).toEqual(expected);
  });
});

describe('UseCaseFromDef.subject', () => {
  const WhoAmIUcDef = defineUseCase({
    ...CompleteTaskUcDef,
    callers: ['user', 'system'],
  });
  class WhoAmI extends UseCaseFromDef<typeof WhoAmIUcDef, Deps, Loaded, User> {
    constructor() {
      super(WhoAmIUcDef, { app: ctx.app, tasks }, moduleOf(WhoAmIUcDef));
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
    const res = await new WhoAmI().handle({ taskId: TASK }, system, REQ);
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
        super(CompleteTaskUcDef, { app: ctx.app, tasks }, TodoModuleDef);
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

describe('UseCaseFromDef — доменные правила', () => {
  let calls: string[];

  const notDone = domainRule({
    name: 'notDone',
    label: 'Задача не выполнена',
    description: 'Действие допустимо только над невыполненной задачей.',
    error: TaskErrors.ALREADY_DONE,
    check: (c: { readonly task: ReadonlyAr<TaskAr> }) => {
      calls.push('rule');
      return c.task.isDone() ? TaskErrors.ALREADY_DONE.err() : ok();
    },
  });

  const RuledUcDef = defineUseCase({
    ...CompleteTaskUcDef,
    callers: ['user', 'system'],
    rules: [notDone],
  });

  class Ruled extends UseCaseFromDef<typeof RuledUcDef, Deps, Loaded> {
    constructor() {
      super(RuledUcDef, { app: ctx.app, tasks }, moduleOf(RuledUcDef));
    }
    protected load = (i: { taskId: string }) => loadTask(tasks, i);
    protected execute = async (
      _: unknown,
      { task }: Loaded,
      uow: UnitOfWork,
    ) => {
      calls.push('execute');
      task.complete(T0);
      uow.register(task, tasks);
      return ok({});
    };
  }

  beforeEach(() => {
    calls = [];
  });

  test('Policy отказала → правила не вызваны', async () => {
    const res = await new Ruled().handle({ taskId: TASK }, user('чужой'), REQ);
    expectErr(res, 'ACCESS_DENIED');
    expect(calls).toEqual([]);
  });

  test('правило отказало → его ошибка, execute не вызван, ничего не зафиксировано', async () => {
    seed('done');
    const res = await new Ruled().handle({ taskId: TASK }, user(OWNER), REQ);
    expectErr(res, 'TASK_ALREADY_DONE');
    expect(calls).toEqual(['rule']);
    expect(tasks.rows.get(TASK)?.status).toBe('done');
    expect(ctx.published).toEqual([]);
  });

  test('правила прошли → execute', async () => {
    expectOk(await new Ruled().handle({ taskId: TASK }, user(OWNER), REQ));
    expect(calls).toEqual(['rule', 'execute']);
  });

  test('для system правила проверяются (Policy — нет)', async () => {
    seed('done');
    const res = await new Ruled().handle({ taskId: TASK }, system, REQ);
    expectErr(res, 'TASK_ALREADY_DONE');
    expect(calls).toEqual(['rule']);
  });

  test('ошибка правила обязана быть в errors UC (ERR-02)', () => {
    const UndeclaredUcDef = defineUseCase({
      ...RuledUcDef,
      errors: [TaskErrors.NOT_FOUND],
    });
    class Undeclared extends UseCaseFromDef<
      typeof UndeclaredUcDef,
      Deps,
      Loaded
    > {
      constructor() {
        super(
          // @ts-expect-error: TASK_ALREADY_DONE правила нет в errors UC
          UndeclaredUcDef,
          { app: ctx.app, tasks },
          moduleOf(UndeclaredUcDef),
        );
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({});
    }
    expect(Undeclared).toBeDefined();
  });

  test('загруженный контекст обязан подходить каждому правилу', () => {
    const fewOpen = domainRule({
      name: 'fewOpen',
      label: 'Мало открытых',
      description: 'Открытых задач меньше предела.',
      error: TaskErrors.ARCHIVED,
      check: (c: { readonly openCount: number }) =>
        c.openCount < 3 ? ok() : TaskErrors.ARCHIVED.err(),
    });
    const TwoRulesUcDef = defineUseCase({
      ...CompleteTaskUcDef,
      rules: [notDone, fewOpen],
    });
    type Uc = typeof TwoRulesUcDef;
    // @ts-expect-error: нет openCount — правилу fewOpen нечего проверять
    type Missing = UseCaseFromDef<Uc, Deps, Loaded>;
    type Full = UseCaseFromDef<Uc, Deps, Loaded & { openCount: number }>;
    expectTypeOf<Missing>().not.toBeNever();
    expectTypeOf<Full>().not.toBeNever();
  });
});
