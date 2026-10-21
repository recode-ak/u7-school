import { describe, expect, test } from 'bun:test';
import type { CallContext } from '#core/kernel/caller/call-context';
import {
  type Caller,
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
import { callUseCase, type UseCaseOwner } from './call-use-case';

const REQ = requestTrace({ requestId: 'r-1' });
const from: OperationRef = { kind: 'useCase', module: 'notes', name: 'notify' };
const caller = new SystemCaller(from, new UserCaller({ uuid: OWNER }));
const call: CallContext = { caller, calls: [GetTaskUcDef], trace: REQ };

type Seen = { input: unknown; caller: Caller; trace: unknown };

/**
 * Модуль-владелец с одной реализацией — `getTask`, которая запоминает вызов;
 * чужой UC — исключение сборки, как у `ModuleFromDef.handle`.
 */
function todoOwner(seen: Seen[]): UseCaseOwner<typeof TodoModuleDef> {
  return {
    def: TodoModuleDef,
    handle: async (def, input, caller, trace) => {
      if (def !== GetTaskUcDef) {
        throw new Error(`UC ${def.name} не реализован в модуле todo`);
      }
      seen.push({ input, caller, trace });
      return ok(taskRow(TASK));
    },
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

  test('исключение сборки владельца — как есть', async () => {
    await expect(
      callUseCase(
        todoOwner([]),
        CompleteTaskUcDef,
        { taskId: TASK },
        { ...call, calls: [CompleteTaskUcDef] },
      ),
    ).rejects.toThrow('UC completeTask не реализован в модуле todo');
  });

  test('UC другого модуля — ошибка компиляции', () => {
    const users = { def: UsersModuleDef, handle: todoOwner([]).handle };
    const wrong = () =>
      // @ts-expect-error getTask не из модуля users
      callUseCase(users, GetTaskUcDef, { taskId: TASK }, call);
    expect(wrong).toBeDefined();
  });
});
