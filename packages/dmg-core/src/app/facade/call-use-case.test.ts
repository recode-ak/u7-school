import { describe, expect, test } from 'bun:test';
import type { AnyUseCaseDef } from '#core/domain/contracts/define-use-case';
import type { CallContext } from '#core/kernel/caller/call-context';
import {
  type Caller,
  type Identified,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { ok } from '#core/kernel/result/result';
import {
  CompleteTaskUcDef,
  GetTaskUcDef,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { UsersModuleDef } from '#core/testing/example/users/index';
import { OWNER, TASK, taskRow } from '../app.fixture';
import { requestTrace } from '../trace';
import type { UseCaseHandler } from '../use-case/use-case-from-def';
import { callUseCase } from './call-use-case';

const REQ = requestTrace({ requestId: 'r-1' });
const from: OperationRef = { kind: 'useCase', module: 'notes', name: 'notify' };
const caller = new SystemCaller(from, new UserCaller({ uuid: OWNER }));
const call: CallContext = { caller, calls: [GetTaskUcDef], trace: REQ };

type Seen = { input: unknown; caller: Caller; trace: unknown };

/** Модуль-владелец с одной реализацией — `getTask`, которая запоминает вызов. */
function todoOwner(seen: Seen[]) {
  const getTask: UseCaseHandler<typeof GetTaskUcDef, Identified> = {
    def: GetTaskUcDef,
    handle: async (input, caller, trace) => {
      seen.push({ input, caller, trace });
      return ok(taskRow(TASK));
    },
  };
  const known: UseCaseHandler<AnyUseCaseDef, Identified> = getTask;
  const isFor = <D extends AnyUseCaseDef>(
    h: UseCaseHandler<AnyUseCaseDef, Identified>,
    def: D,
  ): h is UseCaseHandler<D, Identified> => h.def === def;
  return {
    def: TodoModuleDef,
    useCase: <D extends AnyUseCaseDef>(def: D) =>
      isFor(known, def) ? known : undefined,
  };
}

describe('callUseCase', () => {
  test('вызывает UC владельца от SystemCaller потребителя, след — тот же', async () => {
    const seen: Seen[] = [];
    const res = await callUseCase(
      todoOwner(seen),
      GetTaskUcDef,
      { taskId: TASK },
      call,
    );
    expect(res).toEqual(ok(taskRow(TASK)));
    expect(seen).toEqual([
      {
        input: { taskId: TASK },
        caller,
        trace: REQ,
      },
    ]);
  });

  test('UC нет в calls потребителя — UNAUTHORIZED, UC не вызывается', async () => {
    const seen: Seen[] = [];
    const res = await callUseCase(
      todoOwner(seen),
      GetTaskUcDef,
      { taskId: TASK },
      { ...call, calls: [] },
    );
    expect(res).toEqual(
      CoreErrors.UNAUTHORIZED.err({ callerKind: 'system', from: 'notify' }),
    );
    expect(seen).toEqual([]);
  });

  test('UC не реализован владельцем — исключение сборки', async () => {
    await expect(
      callUseCase(todoOwner([]), CompleteTaskUcDef, { taskId: TASK }, call),
    ).rejects.toThrow('UC completeTask не реализован в модуле todo');
  });

  test('UC другого модуля — ошибка компиляции', () => {
    const users = { def: UsersModuleDef, useCase: todoOwner([]).useCase };
    const wrong = () =>
      // @ts-expect-error getTask не из модуля users
      callUseCase(users, GetTaskUcDef, { taskId: TASK }, call);
    expect(wrong).toBeDefined();
  });
});
