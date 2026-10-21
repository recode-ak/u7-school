import { describe, expect, test } from 'bun:test';
import type { AnyUseCaseDef } from '#core/domain/contracts/define-use-case';
import type { CallContext } from '#core/kernel/caller/call-context';
import type { Caller } from '#core/kernel/caller/caller';
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
const origin: Caller = { kind: 'user', user: { uuid: OWNER } };
const call: CallContext = {
  from: { dmg: 'useCase', name: 'notify', calls: [GetTaskUcDef] },
  caller: origin,
  trace: REQ,
};

type Seen = { input: unknown; caller: Caller; trace: unknown };

/** Модуль-владелец с одной реализацией — `getTask`, которая запоминает вызов. */
function todoOwner(seen: Seen[]) {
  const getTask: UseCaseHandler<typeof GetTaskUcDef, unknown> = {
    def: GetTaskUcDef,
    handle: async (input, caller, trace) => {
      seen.push({ input, caller, trace });
      return ok(taskRow(TASK));
    },
  };
  const known: UseCaseHandler<AnyUseCaseDef, unknown> = getTask;
  const isFor = <D extends AnyUseCaseDef>(
    h: UseCaseHandler<AnyUseCaseDef, unknown>,
    def: D,
  ): h is UseCaseHandler<D, unknown> => h.def === def;
  return {
    def: TodoModuleDef,
    useCase: <D extends AnyUseCaseDef>(def: D) =>
      isFor(known, def) ? known : undefined,
  };
}

describe('callUseCase', () => {
  test('вызывает UC владельца от module: from и origin — из контекста, след — тот же', async () => {
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
        caller: { kind: 'module', from: call.from, origin },
        trace: REQ,
      },
    ]);
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
