import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  test,
} from 'bun:test';
import * as v from 'valibot';
import { defineUseCase } from '../../domain/contracts/define-use-case';
import type { Caller } from '../../kernel/caller/caller';
import { defineErrors } from '../../kernel/errors/define-errors';
import { ok } from '../../kernel/result/result';
import {
  expectErr,
  expectOk,
  resetNow,
  setNow,
  testAppContext,
} from '../../testing';
import {
  CompleteTaskUc,
  TaskAr,
  TaskErrors,
  TaskEvents,
} from '../../testing/example/todo';
import type { TaskState } from '../../testing/example/todo/task/task.state';
import type { AppContext } from '../context';
import type { UnitOfWork } from '../uow/unit-of-work';
import { UseCaseFromDef } from './use-case-from-def';

const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);

const OtherErrors = defineErrors('OTHER', {
  FAILED: { kind: 'conflict', label: 'Сбой', description: 'Чужая ошибка.' },
});

type User = { readonly uuid: string; hasRole(role: 'admin'): boolean };
const user = (uuid: string): Caller<User> => ({
  kind: 'user',
  user: { uuid, hasRole: () => false },
});

class MemoryTasks {
  readonly rows = new Map<string, TaskState>();
  failOnFind = false;
  async findById(id: string): Promise<TaskAr | undefined> {
    if (this.failOnFind) throw new Error('диск недоступен');
    const row = this.rows.get(id);
    return row && TaskAr.restore(row);
  }
  async save(ar: TaskAr): Promise<void> {
    this.rows.set(ar.uuid, ar.snapshot());
  }
}

type Deps = { readonly app: AppContext; readonly tasks: MemoryTasks };
type Loaded = { task: TaskAr };

async function loadTask(tasks: MemoryTasks, input: { taskId: string }) {
  const task = await tasks.findById(input.taskId);
  return task ? ok({ task }) : TaskErrors.NOT_FOUND.err({ taskId: TASK });
}

/** Эталонный UC: загрузить → (Policy в базе) → операция Ar → UoW. */
class CompleteTask extends UseCaseFromDef<typeof CompleteTaskUc, Deps, Loaded> {
  constructor(deps: Deps) {
    super(CompleteTaskUc, deps);
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
  tasks.rows.set(TASK, {
    uuid: TASK,
    ownerId: OWNER,
    title: 'Купить хлеб',
    status,
    createdAt: T0,
    updatedAt: T0,
  });
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
    const res = await uc.handle({ taskId: TASK }, { kind: 'guest' });
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
  });

  test('невалидный вход → INPUT_VALIDATION с путём поля', async () => {
    const res = await uc.handle({ taskId: 'x' }, user(OWNER));
    const issues = expectErr(res, 'INPUT_VALIDATION').payload.issues;
    expect(issues.map((i) => i.path)).toEqual(['taskId']);
  });

  test('ошибка загрузки возвращается как есть', async () => {
    tasks.rows.clear();
    const res = await uc.handle({ taskId: TASK }, user(OWNER));
    expectErr(res, 'TASK_NOT_FOUND');
  });

  test('отказ Policy → ACCESS_DENIED с правилом', async () => {
    const res = await uc.handle({ taskId: TASK }, user('чужой'));
    expect(expectErr(res, 'ACCESS_DENIED').payload.rule).toBe('canManage');
  });

  test('system из callers Policy не проверяет', async () => {
    const SystemUc = defineUseCase({
      ...CompleteTaskUc,
      callers: ['system'],
    });
    class SystemComplete extends UseCaseFromDef<typeof SystemUc, Deps, Loaded> {
      constructor() {
        super(SystemUc, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({});
    }
    const system: Caller<User> = { kind: 'system', source: 'test' };
    expectOk(await new SystemComplete().handle({ taskId: TASK }, system));
  });
});

describe('UseCaseFromDef.handle — операция', () => {
  test('Ok → сохранение, публикация, выход', async () => {
    expect(expectOk(await uc.handle({ taskId: TASK }, user(OWNER)))).toEqual(
      {},
    );
    expect(tasks.rows.get(TASK)?.status).toBe('done');
    expect(ctx.published.map((e) => e.name)).toEqual([
      TaskEvents.completed.name,
    ]);
  });

  test('Err операции → без сохранения и публикации', async () => {
    seed('done');
    const res = await uc.handle({ taskId: TASK }, user(OWNER));
    expectErr(res, 'TASK_ALREADY_DONE');
    expect(ctx.published).toEqual([]);
  });

  test('незаявленное событие в test → SERVER_INTERNAL, ничего не записано', async () => {
    uc.mutate = (task) => task.archive();
    const res = await uc.handle({ taskId: TASK }, user(OWNER));
    expectErr(res, 'SERVER_INTERNAL');
    expect(tasks.rows.get(TASK)?.status).toBe('open');
  });

  test('незаявленное событие в production — без проверки', async () => {
    const prod = testAppContext('production');
    uc = new CompleteTask({ app: prod.app, tasks });
    uc.mutate = (task) => task.archive();
    expectOk(await uc.handle({ taskId: TASK }, user(OWNER)));
    expect(prod.published.map((e) => e.name)).toEqual([
      TaskEvents.archived.name,
    ]);
  });

  test('исключение → SERVER_INTERNAL и запись в лог', async () => {
    tasks.failOnFind = true;
    const res = await uc.handle({ taskId: TASK }, user(OWNER));
    expectErr(res, 'SERVER_INTERNAL');
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'completeTask' }),
    );
  });

  test('невалидный выход → OUTPUT_VALIDATION', async () => {
    const BadOutputUc = defineUseCase({
      ...CompleteTaskUc,
      output: v.object({ taskId: v.pipe(v.string(), v.uuid()) }),
    });
    class BadOutput extends UseCaseFromDef<typeof BadOutputUc, Deps, Loaded> {
      constructor() {
        super(BadOutputUc, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      protected execute = async () => ok({ taskId: 'не uuid' });
    }
    const res = await new BadOutput().handle({ taskId: TASK }, user(OWNER));
    expectErr(res, 'OUTPUT_VALIDATION');
  });
});

describe('UseCaseFromDef — типы', () => {
  test('execute не может вернуть незаявленную ошибку (ERR-02)', () => {
    class Undeclared extends UseCaseFromDef<
      typeof CompleteTaskUc,
      Deps,
      Loaded
    > {
      constructor() {
        super(CompleteTaskUc, { app: ctx.app, tasks });
      }
      protected load = (i: { taskId: string }) => loadTask(tasks, i);
      // @ts-expect-error: OTHER_FAILED нет в errors CompleteTaskUc
      protected execute = async () => OtherErrors.FAILED.err();
    }
    expect(Undeclared).toBeDefined();
  });

  test('загруженный контекст обязан подходить Policy', () => {
    type Uc = typeof CompleteTaskUc;
    // @ts-expect-error: { title } не TaskCtx — Policy нечего проверять
    type WrongCtx = UseCaseFromDef<Uc, Deps, { title: string }>;
    expectTypeOf<WrongCtx>().not.toBeNever();
  });
});
