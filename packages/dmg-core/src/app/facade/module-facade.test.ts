import { describe, expect, test } from 'bun:test';
import type { AnyUseCaseDef } from '#core/domain/contracts/define-use-case';
import {
  type Caller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import {
  CompleteTaskUcDef,
  CreateTaskUcDef,
  GetTaskUcDef,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import {
  RemoveUserUcDef,
  UsersModuleDef,
} from '#core/testing/example/users/index';
import { expectOk } from '#core/testing/expect-result';
import { StubFacade } from '#core/testing/stub-facade';
import { OWNER, TASK, taskRow } from '../app.fixture';
import { requestTrace } from '../trace';
import { type FacadeModule, ModuleFacade } from './module-facade';
import { ModuleFacades } from './module-facades';

const REQ = requestTrace({ requestId: 'r-1' });
const from: OperationRef = { kind: 'useCase', module: 'notes', name: 'notify' };
const caller = new SystemCaller(from, new UserCaller({ uuid: OWNER }));

type Seen = {
  def: AnyUseCaseDef;
  input: unknown;
  caller: Caller;
  trace: unknown;
};

/**
 * Модуль todo с одной реализацией — `getTask`, которая запоминает вызов;
 * UC без реализации — исключение сборки, как у `ModuleFromDef.handle`.
 */
function todoModule(seen: Seen[]): FacadeModule<typeof TodoModuleDef> {
  return {
    def: TodoModuleDef,
    serves: (def) => def === GetTaskUcDef,
    handle: async (def, input, caller, trace) => {
      if (def !== GetTaskUcDef) {
        throw new Error(`UC ${def.name} не реализован в модуле todo`);
      }
      seen.push({ def, input, caller, trace });
      return ok(taskRow(TASK));
    },
  };
}

describe('ModuleFacade', () => {
  test('handle — вход модуля: UC, вход, вызывающий и след как есть', async () => {
    const seen: Seen[] = [];
    const todo = new ModuleFacade(todoModule(seen));
    const res = await todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(res).toEqual(ok(taskRow(TASK)));
    // Выход типизирован по Def UC: state задачи.
    expect(expectOk(res).status).toBe('open');
    expect(seen).toEqual([
      { def: GetTaskUcDef, input: { taskId: TASK }, caller, trace: REQ },
    ]);
  });

  test('def и serves — от модуля', () => {
    const todo = new ModuleFacade(todoModule([]));
    expect(todo.def).toBe(TodoModuleDef);
    expect(todo.serves(GetTaskUcDef)).toBe(true);
    expect(todo.serves(CompleteTaskUcDef)).toBe(false);
  });

  test('UC без system в callers и UC другого модуля — ошибка типа', () => {
    const todo = new ModuleFacade(todoModule([]));
    const wrong = () => [
      // @ts-expect-error createTask не вызывается системой
      todo.handle(CreateTaskUcDef, { title: 'x' }, caller, REQ),
      // @ts-expect-error removeUser не из модуля todo
      todo.handle(RemoveUserUcDef, { userId: OWNER }, caller, REQ),
    ];
    expect(wrong).toBeFunction();
  });
});

describe('ModuleFacades', () => {
  test('call — фасад, который обслуживает UC', async () => {
    const seen: Seen[] = [];
    const users = new StubFacade(UsersModuleDef).answer(RemoveUserUcDef, () =>
      ok({}),
    );
    const facades = new ModuleFacades([
      users,
      new ModuleFacade(todoModule(seen)),
    ]);
    const res = await facades.call(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(res).toEqual(ok(taskRow(TASK)));
    expect(seen).toHaveLength(1);
    expect(users.received).toEqual([]);
    const removed = await facades.call(
      RemoveUserUcDef,
      { userId: OWNER },
      caller,
      REQ,
    );
    expect(removed).toEqual(ok({}));
  });

  test('нет фасада для UC — исключение сборки', async () => {
    const facades = new ModuleFacades([new ModuleFacade(todoModule([]))]);
    await expect(
      facades.call(RemoveUserUcDef, { userId: OWNER }, caller, REQ),
    ).rejects.toThrow('Нет фасада модуля для UC removeUser');
  });

  test('пустой набор — модуль без зависимостей', async () => {
    await expect(
      new ModuleFacades().call(GetTaskUcDef, { taskId: TASK }, caller, REQ),
    ).rejects.toThrow('Нет фасада модуля для UC getTask');
  });
});
