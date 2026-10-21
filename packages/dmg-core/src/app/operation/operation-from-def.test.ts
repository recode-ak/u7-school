import { beforeEach, describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { defineEventReaction } from '#core/domain/contracts/define-event-reaction';
import { defineJob } from '#core/domain/contracts/define-job';
import { defineModule } from '#core/domain/contracts/define-module';
import {
  defineUseCase,
  type UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import {
  type Caller,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { err, ok } from '#core/kernel/result/result';
import {
  GetTaskUcDef,
  TaskErrors,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { UserEvents } from '#core/testing/example/users/index';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { StubFacade } from '#core/testing/stub-facade';
import { OWNER, T0, TASK, taskRow } from '../app.fixture';
import type { ModuleDeps } from '../context';
import type { EnvelopeOf } from '../events/event-envelope';
import { ModuleFacades } from '../facade/module-facades';
import { JobFromDef, type JobRun } from '../job/job-from-def';
import { ReactionFromDef } from '../reaction/reaction-from-def';
import { jobTrace, requestTrace, type Trace } from '../trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import { UseCaseFromDef } from '../use-case/use-case-from-def';

// Модуль-потребитель todo: UC, ER и Job вызывают `getTask` через
// `this.call` (D-43, Р5) — фасад todo в тесте — `StubFacade`.
const DigestArDef = defineAggregate({
  name: 'digest',
  label: 'Сводка',
  description: 'Сводка по задачам — агрегат модуля-потребителя.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

const showSpec = {
  name: 'showTask',
  label: 'Показать задачу',
  description: 'Выполнена ли задача — читает её через фасад todo.',
  type: 'query',
  aggregate: DigestArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ taskId: F.uuid('задачи') }),
  output: v.object({ status: v.string() }),
  errors: [TaskErrors.NOT_FOUND],
} as const;

const ShowTaskUcDef = defineUseCase({ ...showSpec, calls: [GetTaskUcDef] });
/** Тот же UC без `calls` — вызвать `getTask` ему нельзя по типу. */
const SilentUcDef = defineUseCase({ ...showSpec, name: 'silent' });
/**
 * UC без доменных ошибок: `TASK_NOT_FOUND` вызванного UC не объявлен —
 * переводит его в свой ответ, ошибки ядра отдаёт как есть (D-43, Р7).
 */
const TranslateUcDef = defineUseCase({
  ...showSpec,
  name: 'translate',
  errors: [],
  calls: [GetTaskUcDef],
});

const NoteRemovedErDef = defineEventReaction({
  name: 'noteRemoved',
  label: 'Отметить удаление',
  description: 'Читает задачу удалённого пользователя через фасад todo.',
  on: [UserEvents.removed],
  calls: [GetTaskUcDef],
});
/** Реакция без `calls`. */
const SilentErDef = defineEventReaction({
  name: 'silentEr',
  label: 'Молчаливая реакция',
  description: 'Ничего не вызывает.',
  on: [UserEvents.removed],
});

const DigestJobDef = defineJob({
  name: 'digestJob',
  label: 'Сводка',
  description: 'Читает задачу через фасад todo.',
  schedule: { kind: 'dailyAt', hour: 3, minute: 0 },
  calls: [GetTaskUcDef],
});
/** Задание без `calls`. */
const SilentJobDef = defineJob({
  name: 'silentJob',
  label: 'Молчаливое задание',
  description: 'Ничего не вызывает.',
  schedule: { kind: 'dailyAt', hour: 4, minute: 0 },
});

const DigestModuleDef = defineModule({
  name: 'digest',
  label: 'Сводки',
  description: 'Модуль-потребитель фасада todo.',
  dependsOn: [TodoModuleDef],
  aggregates: [DigestArDef],
  useCases: [ShowTaskUcDef, SilentUcDef, TranslateUcDef],
  reactions: [NoteRemovedErDef, SilentErDef],
  jobs: [DigestJobDef, SilentJobDef],
});

type User = { readonly uuid: string };
const REQ = requestTrace({ requestId: 'r-1' });

class ShowTask extends UseCaseFromDef<
  typeof ShowTaskUcDef,
  ModuleDeps,
  undefined,
  User
> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(ShowTaskUcDef, deps, module);
  }
  protected load = async () => ok(undefined);
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller<User>,
    trace: Trace,
  ) {
    const task = await this.call(GetTaskUcDef, input, caller, trace);
    if (!task.ok) return task;
    return ok({ status: task.value.status });
  }
}

class Silent extends UseCaseFromDef<
  typeof SilentUcDef,
  ModuleDeps,
  undefined,
  User
> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(SilentUcDef, deps, module);
  }
  protected load = async () => ok(undefined);
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller<User>,
    trace: Trace,
  ) {
    // @ts-expect-error getTask нет в calls UC silent
    await this.call(GetTaskUcDef, input, caller, trace);
    return ok({ status: 'никогда' });
  }
}

class Translate extends UseCaseFromDef<
  typeof TranslateUcDef,
  ModuleDeps,
  undefined,
  User
> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(TranslateUcDef, deps, module);
  }
  protected load = async () => ok(undefined);
  protected async execute(
    input: { taskId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller<User>,
    trace: Trace,
  ) {
    const task = await this.call(GetTaskUcDef, input, caller, trace);
    if (task.ok) return ok({ status: task.value.status });
    if (task.error.code === TaskErrors.NOT_FOUND.code) {
      return ok({ status: 'нет задачи' });
    }
    return err(task.error);
  }
}

class NoteRemoved extends ReactionFromDef<typeof NoteRemovedErDef, ModuleDeps> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(NoteRemovedErDef, deps, module);
  }
  protected async react(
    _: unknown,
    __: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    const task = await this.call(GetTaskUcDef, { taskId: TASK }, caller, trace);
    return task.ok ? ok() : task;
  }
}

class SilentEr extends ReactionFromDef<typeof SilentErDef, ModuleDeps> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(SilentErDef, deps, module);
  }
  protected async react(
    _: unknown,
    __: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    // @ts-expect-error у реакции silentEr нет calls
    await this.call(GetTaskUcDef, { taskId: TASK }, caller, trace);
    return ok();
  }
}

class DigestJob extends JobFromDef<typeof DigestJobDef, ModuleDeps> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(DigestJobDef, deps, module);
  }
  protected run = async (job: JobRun) => {
    const task = await this.call(
      GetTaskUcDef,
      { taskId: TASK },
      this.caller,
      job.trace,
    );
    return { processed: task.ok ? 1 : 0, failed: task.ok ? 0 : 1 };
  };
}

class SilentJob extends JobFromDef<typeof SilentJobDef, ModuleDeps> {
  constructor(deps: ModuleDeps, module: typeof DigestModuleDef) {
    super(SilentJobDef, deps, module);
  }
  protected run = async (job: JobRun) => {
    // @ts-expect-error у задания silentJob нет calls
    await this.call(GetTaskUcDef, { taskId: TASK }, this.caller, job.trace);
    return { processed: 0, failed: 0 };
  };
}

const removed = (): EnvelopeOf<typeof UserEvents.removed> => ({
  ...UserEvents.removed.make({ userId: OWNER }),
  eventId: 'e-removed',
  occurredAt: T0,
  aggregateId: OWNER,
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

let todo: StubFacade<typeof TodoModuleDef>;
let deps: ModuleDeps;

beforeEach(() => {
  todo = new StubFacade(TodoModuleDef).answer(GetTaskUcDef, ({ taskId }) =>
    ok(taskRow(taskId, 'done')),
  );
  deps = {
    app: testAppContext({ at: T0 }).app,
    facades: new ModuleFacades([todo]),
  };
});

describe('OperationFromDef.call — UC (D-43, Р5)', () => {
  test('UC из calls — через фасад от SystemCaller этого UC с человеком, след тот же', async () => {
    const uc = new ShowTask(deps, DigestModuleDef);
    const user = new UserCaller<User>({ uuid: OWNER });
    const res = await uc.handle({ taskId: TASK }, user, REQ);
    expect(expectOk(res)).toEqual({ status: 'done' });
    expect(todo.received).toEqual([
      {
        def: GetTaskUcDef,
        input: { taskId: TASK },
        caller: new SystemCaller(uc.ref, user),
        trace: REQ,
      },
    ]);
  });

  test('ошибка вызванного UC — как есть', async () => {
    todo = new StubFacade(TodoModuleDef).answer(GetTaskUcDef, ({ taskId }) =>
      TaskErrors.NOT_FOUND.err({ taskId }),
    );
    const uc = new ShowTask(
      { ...deps, facades: new ModuleFacades([todo]) },
      DigestModuleDef,
    );
    const res = await uc.handle(
      { taskId: TASK },
      new UserCaller<User>({ uuid: OWNER }),
      REQ,
    );
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({ taskId: TASK });
  });

  test('необъявленная доменная ошибка вызванного UC — ошибка типа, ядра — проходит', () => {
    const notFound: UseCaseErrorOf<typeof GetTaskUcDef> =
      TaskErrors.NOT_FOUND.make({ taskId: TASK });
    const denied: UseCaseErrorOf<typeof GetTaskUcDef> =
      CoreErrors.ACCESS_DENIED.make({ rule: 'r', denyMessage: 'нет' });
    // @ts-expect-error TASK_NOT_FOUND нет в errors UC translate
    const leaked: UseCaseErrorOf<typeof TranslateUcDef> = notFound;
    const passed: UseCaseErrorOf<typeof TranslateUcDef> = denied;
    const values: readonly unknown[] = [leaked, passed];
    expect(values).toEqual([notFound, denied]);
  });

  test('доменная ошибка вызванного UC — перевод, ошибка ядра — как есть', async () => {
    const user = new UserCaller<User>({ uuid: OWNER });
    const answer = (error: UseCaseErrorOf<typeof GetTaskUcDef>) =>
      new Translate(
        {
          ...deps,
          facades: new ModuleFacades([
            new StubFacade(TodoModuleDef).answer(GetTaskUcDef, () =>
              err(error),
            ),
          ]),
        },
        DigestModuleDef,
      ).handle({ taskId: TASK }, user, REQ);
    const missing = await answer(TaskErrors.NOT_FOUND.make({ taskId: TASK }));
    expect(expectOk(missing)).toEqual({ status: 'нет задачи' });
    const denied = await answer(
      CoreErrors.ACCESS_DENIED.make({ rule: 'r', denyMessage: 'нет' }),
    );
    expect(expectErr(denied, 'ACCESS_DENIED').payload).toEqual({
      rule: 'r',
      denyMessage: 'нет',
    });
  });

  test('UC не из calls — ошибка типа (рантайм-проверки нет)', () => {
    expect(new Silent(deps, DigestModuleDef).ref.name).toBe('silent');
  });

  test('ref — от базы: вид, модуль из ModuleDef, имя', () => {
    const uc = new ShowTask(deps, DigestModuleDef);
    expect(uc.ref).toEqual({
      kind: 'useCase',
      module: 'digest',
      name: 'showTask',
    });
  });
});

describe('OperationFromDef.call — ER и Job', () => {
  test('реакция — SystemCaller реакции без человека, след события', async () => {
    const er = new NoteRemoved(deps, DigestModuleDef);
    expectOk(await er.handle(removed()));
    const [call] = todo.received;
    expect(call?.caller).toEqual(new SystemCaller(er.ref));
    expect(call?.caller.person()).toBeUndefined();
    expect(call?.trace).toEqual({
      cause: { kind: 'event', eventId: 'e-removed' },
      correlationId: 'c-1',
    });
  });

  test('задание — SystemCaller задания без человека, след прогона', async () => {
    const job = new DigestJob(deps, DigestModuleDef);
    const run = jobTrace();
    expect(expectOk(await job.handle(run))).toEqual({
      processed: 1,
      failed: 0,
    });
    const [call] = todo.received;
    expect(call?.caller).toEqual(new SystemCaller(job.ref));
    expect(call?.trace).toBe(run);
  });

  test('ER и Job без calls — вызов не компилируется', () => {
    expect(new SilentEr(deps, DigestModuleDef).ref.name).toBe('silentEr');
    expect(new SilentJob(deps, DigestModuleDef).ref.name).toBe('silentJob');
  });
});
