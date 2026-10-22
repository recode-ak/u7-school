import { describe, expect, test } from 'bun:test';
import { SystemCaller, UserCaller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import {
  CreateTaskUcDef,
  GetTaskUcDef,
  ListTasksUcDef,
  TaskErrors,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { RemoveUserUcDef } from '#core/testing/example/users/index';
import { OWNER, TASK, taskRow } from '../app/app.fixture';
import { expectErr, expectOk } from './expect-result';
import { StubFacade } from './stub-facade';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new SystemCaller(
  { kind: 'useCase', module: 'digest', name: 'showTask' },
  new UserCaller({ uuid: OWNER }),
);

describe('StubFacade', () => {
  test('ответ по Def: вход, вызывающий и след — те, что передал вызов', async () => {
    const seen: unknown[] = [];
    const todo = new StubFacade(TodoModuleDef).answer(
      GetTaskUcDef,
      (input, from, trace) => {
        seen.push(input, from, trace);
        return ok(taskRow(input.taskId));
      },
    );
    const res = await todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(expectOk(res)).toEqual(taskRow(TASK));
    expect(seen).toEqual([{ taskId: TASK }, caller, REQ]);
    expect(todo.def).toBe(TodoModuleDef);
  });

  test('ответ — Promise и ошибка UC: отдаются как есть', async () => {
    const todo = new StubFacade(TodoModuleDef).answer(GetTaskUcDef, async () =>
      TaskErrors.NOT_FOUND.err({ taskId: TASK }),
    );
    const res = await todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({ taskId: TASK });
  });

  test('received — вызовы по порядку: Def, вход, вызывающий, след', async () => {
    const todo = new StubFacade(TodoModuleDef).answer(GetTaskUcDef, (i) =>
      ok(taskRow(i.taskId)),
    );
    expect(todo.received).toEqual([]);
    await todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ);
    expect(todo.received).toEqual([
      { def: GetTaskUcDef, input: { taskId: TASK }, caller, trace: REQ },
    ]);
  });

  test('serves — UC модуля фасада', () => {
    const todo = new StubFacade(TodoModuleDef);
    expect(todo.serves(GetTaskUcDef)).toBe(true);
    expect(todo.serves(ListTasksUcDef)).toBe(true);
    expect(todo.serves(RemoveUserUcDef)).toBe(false);
  });

  test('Def без ответа — понятная ошибка теста', async () => {
    const todo = new StubFacade(TodoModuleDef);
    await expect(
      todo.handle(GetTaskUcDef, { taskId: TASK }, caller, REQ),
    ).rejects.toThrow('StubFacade todo: нет ответа для UC getTask');
  });

  test('у UC нет system в callers — ответ не задаётся (ошибка типа)', () => {
    const todo = new StubFacade(TodoModuleDef);
    const wrong = () =>
      // @ts-expect-error createTask не вызывается системой
      todo.answer(CreateTaskUcDef, () => ok({ taskId: TASK }));
    expect(wrong).toBeFunction();
  });

  test('UC другого модуля — ошибка типа', () => {
    const todo = new StubFacade(TodoModuleDef);
    const wrong = () =>
      // @ts-expect-error removeUser не из модуля todo
      todo.answer(RemoveUserUcDef, () => ok({}));
    expect(wrong).toBeFunction();
  });
});
