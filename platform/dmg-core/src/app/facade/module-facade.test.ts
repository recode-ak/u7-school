import { describe, expect, test } from 'bun:test';
import type { Command } from '#core/domain/contracts/command';
import {
  type Caller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
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
import { type FacadeModule, ModuleFacade } from './module-facade';
import { ModuleFacades } from './module-facades';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const from: OperationRef = { kind: 'useCase', module: 'notes', name: 'notify' };
const caller = new SystemCaller(from, new UserCaller({ uuid: OWNER }));

type Seen = {
  command: Command;
  caller: Caller;
  trace: unknown;
};

/**
 * Модуль todo, который запоминает команды и на любую отвечает задачей —
 * фасаду важно только, что он передал модулю.
 */
function todoModule(seen: Seen[]): FacadeModule<typeof TodoModuleDef> {
  return {
    def: TodoModuleDef,
    dispatch: async (command, caller, trace) => {
      seen.push({ command, caller, trace });
      // Ответ getTask — единственного UC, который зовут тесты.
      return ok(taskRow(TASK)) as never;
    },
  };
}

describe('ModuleFacade', () => {
  test('handle — команда модулю (D-49): вызывающий и след как есть', async () => {
    const seen: Seen[] = [];
    const todo = new ModuleFacade(todoModule(seen));
    const res = await todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(res).toEqual(ok(taskRow(TASK)));
    // Выход типизирован по Def UC: state задачи.
    expect(expectOk(res).status).toBe('open');
    expect(seen).toEqual([
      {
        command: GetTaskUcDef.command({ taskId: TASK }),
        caller,
        trace: REQ,
      },
    ]);
  });

  test('def — от модуля, serves — UC из Def модуля', () => {
    const todo = new ModuleFacade(todoModule([]));
    expect(todo.def).toBe(TodoModuleDef);
    expect(todo.serves(GetTaskUcDef)).toBe(true);
    expect(todo.serves(CompleteTaskUcDef)).toBe(true);
    expect(todo.serves(RemoveUserUcDef)).toBe(false);
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
