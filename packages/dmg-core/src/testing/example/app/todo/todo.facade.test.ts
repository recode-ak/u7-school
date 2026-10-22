import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as v from 'valibot';
import type { ModuleDeps } from '#core/app/context';
import { ModuleFacade } from '#core/app/facade/module-facade';
import { ModuleFacades } from '#core/app/facade/module-facades';
import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { defineModule } from '#core/domain/contracts/define-module';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import { type Caller, UserCaller } from '#core/kernel/caller/caller';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { ok } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import {
  GetTaskUcDef,
  TaskAr,
  TaskErrors,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import {
  expectErr,
  expectOk,
  StubFacade,
  testAppContext,
} from '#core/testing/index';
import { TaskJsonRepo } from './infra/task.json-repo';
import { createTodoModule } from './todo.module';

// Потребитель фасада todo — UC другого модуля: объявляет `getTask` в
// `calls` и вызывает его через `this.call` (D-43). Вместе с владельцем —
// фасад `ModuleFacade` над настоящим модулем todo; потребитель отдельно —
// `StubFacade` с ответом по Def.
const DigestArDef = defineAggregate({
  name: 'digest',
  label: 'Сводка',
  description: 'Сводка по задачам — агрегат модуля-потребителя.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

const showTaskSpec = {
  name: 'showTask',
  label: 'Показать задачу',
  description: 'Выполнена ли задача — читает её через фасад todo.',
  type: 'query',
  aggregate: DigestArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ taskId: F.uuid('задачи') }),
  output: v.object({ done: v.pipe(v.boolean(), v.description('Выполнена')) }),
  errors: [TaskErrors.NOT_FOUND],
} as const;

const ShowTaskUcDef = defineUseCase({ ...showTaskSpec, calls: [GetTaskUcDef] });
/** Тот же UC, но `getTask` в `calls` не объявлен — вызов не компилируется. */
const SneakyUcDef = defineUseCase({ ...showTaskSpec, name: 'sneaky' });

const DigestModuleDef = defineModule({
  name: 'digest',
  label: 'Сводки',
  description: 'Модуль-потребитель фасада todo.',
  dependsOn: [TodoModuleDef],
  aggregates: [DigestArDef],
  useCases: [ShowTaskUcDef, SneakyUcDef],
  reactions: [],
  jobs: [],
});

class ShowTask extends UseCaseFromDef<
  typeof ShowTaskUcDef,
  ModuleDeps,
  undefined,
  ExampleUser
> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(ShowTaskUcDef, deps, module);
  }
  protected async load() {
    return ok(undefined);
  }
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller<ExampleUser>,
    trace: Trace,
  ) {
    const res = await this.call(GetTaskUcDef, input, caller, trace);
    if (!res.ok) return res;
    const task = TaskAr.readonly(res.value);
    return ok({ done: task.isDone() });
  }
}

class Sneaky extends UseCaseFromDef<
  typeof SneakyUcDef,
  ModuleDeps,
  undefined,
  ExampleUser
> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(SneakyUcDef, deps, module);
  }
  protected async load() {
    return ok(undefined);
  }
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller<ExampleUser>,
    trace: Trace,
  ) {
    // @ts-expect-error getTask нет в calls UC sneaky
    await this.call(GetTaskUcDef, input, caller, trace);
    return ok({ done: false });
  }
}

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) =>
  new UserCaller<ExampleUser>({ uuid, hasRole: () => false });

let dir: string;
let taskId: string;
let show: ShowTask;
let deps: ModuleDeps;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'todo-facade-'));
  const tasks = new TaskJsonRepo(join(dir, 'tasks.json'));
  const created = TaskAr.create(
    { uuid: crypto.randomUUID(), ownerId: OWNER, title: 'Купить хлеб' },
    T0,
  );
  if (!created.ok) throw new Error('задача не создана');
  await tasks.save(created.value);
  taskId = created.value.uuid;
  const { app } = testAppContext();
  const todo = createTodoModule({ app, facades: new ModuleFacades(), tasks });
  deps = { app, facades: new ModuleFacades([new ModuleFacade(todo)]) };
  show = new ShowTask(deps, DigestModuleDef);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('фасад todo (D-43)', () => {
  it('вызов через фасад: UC todo от SystemCaller, ответ — ReadonlyAr', async () => {
    const res = await show.handle({ taskId }, as(OWNER), REQ);
    expect(expectOk(res)).toEqual({ done: false });
  });

  it('Policy todo — по субъекту исходного вызывающего', async () => {
    const res = await show.handle({ taskId }, as('чужой'), REQ);
    expectErr(res, 'ACCESS_DENIED');
  });

  it('ошибка UC todo — как есть', async () => {
    const missing = crypto.randomUUID();
    const res = await show.handle({ taskId: missing }, as(OWNER), REQ);
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: missing,
    });
  });

  it('UC нет в calls потребителя — ошибка типа (рантайм-проверки нет)', () => {
    expect(new Sneaky(deps, DigestModuleDef).ref.name).toBe('sneaky');
  });
});

describe('потребитель фасада todo отдельно — StubFacade (D-43)', () => {
  it('ответ по Def; вызов — от SystemCaller операции с человеком пришедшего', async () => {
    const task = expectOk(
      TaskAr.create({ uuid: taskId, ownerId: OWNER, title: 'Хлеб' }, T0),
    );
    expectOk(task.complete(T0));
    const todo = new StubFacade(TodoModuleDef).answer(GetTaskUcDef, () =>
      ok(task.snapshot()),
    );
    const consumer = new ShowTask(
      { app: deps.app, facades: new ModuleFacades([todo]) },
      DigestModuleDef,
    );
    const owner = as(OWNER);

    const res = await consumer.handle({ taskId }, owner, REQ);

    expect(expectOk(res)).toEqual({ done: true });
    expect(todo.received).toHaveLength(1);
    const [call] = todo.received;
    expect(call?.input).toEqual({ taskId });
    expect(call?.caller.from).toEqual(consumer.ref);
    expect(call?.caller.person()).toBe(owner);
  });
});
