import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as v from 'valibot';
import type { AppContext } from '#core/app/context';
import { requestTrace, type Trace } from '#core/app/trace';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import type { Caller } from '#core/kernel/caller/caller';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { ok } from '#core/kernel/result/result';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import {
  GetTaskUcDef,
  TaskAr,
  TaskErrors,
  type TodoFacade,
} from '#core/testing/example/todo/index';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from './infra/task.json-repo';
import { todoFacade } from './todo.facade';
import { createTodoModule } from './todo.module';

// Потребитель фасада todo — UC другого модуля: объявляет `getTask` в
// `calls` и вызывает его через фасад от своего контекста вызова (D-42).
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
/** Тот же UC, но `getTask` в `calls` не объявлен. */
const SneakyUcDef = defineUseCase({ ...showTaskSpec, name: 'sneaky' });

type DigestDeps = { readonly app: AppContext; readonly todo: TodoFacade };

class ShowTask extends UseCaseFromDef<
  typeof ShowTaskUcDef | typeof SneakyUcDef,
  DigestDeps,
  undefined,
  ExampleUser
> {
  protected load = async () => ok(undefined);
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: unknown,
    caller: Caller<ExampleUser>,
    trace: Trace,
  ) {
    const call = this.callContext(caller, trace);
    const task = await this.resolve.todo.getTask(call, input.taskId);
    if (!task.ok) return task;
    return ok({ done: task.value.isDone() });
  }
}

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const REQ = requestTrace({ requestId: 'r-1' });
const as = (uuid: string): Caller<ExampleUser> => ({
  kind: 'user',
  user: { uuid, hasRole: () => false },
});

let dir: string;
let taskId: string;
let show: (def: typeof ShowTaskUcDef | typeof SneakyUcDef) => ShowTask;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'todo-facade-'));
  const tasks = new TaskJsonRepo(join(dir, 'tasks.json'));
  const created = TaskAr.create(
    { uuid: crypto.randomUUID(), ownerId: OWNER, title: 'Купить хлеб' },
    Date.UTC(2026, 9, 1),
  );
  if (!created.ok) throw new Error('задача не создана');
  await tasks.save(created.value);
  taskId = created.value.uuid;
  const { app } = testAppContext();
  const todo = todoFacade(createTodoModule({ app, tasks }));
  show = (def) => new ShowTask(def, { app, todo });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('фасад todo (D-42)', () => {
  it('вызов через фасад: UC todo от module, ответ — ReadonlyAr', async () => {
    const res = await show(ShowTaskUcDef).handle({ taskId }, as(OWNER), REQ);
    expect(expectOk(res)).toEqual({ done: false });
  });

  it('Policy todo — по субъекту исходного вызывающего', async () => {
    const res = await show(ShowTaskUcDef).handle({ taskId }, as('чужой'), REQ);
    expectErr(res, 'ACCESS_DENIED');
  });

  it('ошибка UC todo — как есть', async () => {
    const missing = crypto.randomUUID();
    const res = await show(ShowTaskUcDef).handle(
      { taskId: missing },
      as(OWNER),
      REQ,
    );
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: missing,
    });
  });

  it('UC нет в calls потребителя — UNAUTHORIZED', async () => {
    const res = await show(SneakyUcDef).handle({ taskId }, as(OWNER), REQ);
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'module',
      from: 'sneaky',
    });
  });
});
