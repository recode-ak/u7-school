import { describe, expect, expectTypeOf, test } from 'bun:test';
import type { Command } from '#core/domain/contracts/command';
import type {
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/use-case-def';
import { type Caller, UserCaller } from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { ok, type Result } from '#core/kernel/result/result';
import type { SerializedResult } from '#core/kernel/result/serialized-result.types';
import { Trace } from '#core/kernel/trace/trace';
import {
  CompleteTaskUcDef,
  GetTaskUcDef,
  TaskErrors,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import { RemoveUserUcDef } from '#core/testing/example/users/index';
import { type LogRecord, MemoryLogger } from '#core/testing/memory-logger';
import { OWNER, TASK, taskRow } from '../app.fixture';
import { type CommandTransport, ModuleApi } from './module-api';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new UserCaller({ uuid: OWNER });

type Sent = { module: string; command: Command; caller: Caller };

/** Транспорт, который запоминает отправленное и отвечает задачей. */
function transport(sent: Sent[]): CommandTransport {
  return {
    dispatch: async (module, command, caller) => {
      sent.push({ module, command, caller });
      // Ответ getTask — единственного UC, который зовут тесты dispatch.
      return ok(taskRow(TASK)) as never;
    },
  };
}

function api(logs: LogRecord[] = []) {
  return new ModuleApi(TodoModuleDef, transport([]), new MemoryLogger(logs));
}

describe('ModuleApi.dispatch', () => {
  test('команда — по адресу модуля из Def, ответ транспорта как есть', async () => {
    const sent: Sent[] = [];
    const todo = new ModuleApi(
      TodoModuleDef,
      transport(sent),
      new MemoryLogger(),
    );
    const command = GetTaskUcDef.command({ taskId: TASK });

    const res = await todo.dispatch(command, caller, REQ);

    expect(res).toEqual(ok(taskRow(TASK)));
    expect(sent).toEqual([{ module: 'todo', command, caller }]);
  });

  test('ответ типизирован по Def команды', () => {
    const res = api().dispatch(
      GetTaskUcDef.command({ taskId: TASK }),
      caller,
      REQ,
    );
    type Get = typeof GetTaskUcDef;
    expectTypeOf(res).toEqualTypeOf<
      Promise<Result<OutputOf<Get>, UseCaseErrorOf<Get>>>
    >();
  });

  test('команда UC другого модуля — ошибка типа', () => {
    const wrong = () =>
      api().dispatch(
        // @ts-expect-error removeUser — UC модуля users
        RemoveUserUcDef.command({ userId: OWNER }),
        caller,
        REQ,
      );
    expect(wrong).toBeFunction();
  });
});

describe('ModuleApi.restore', () => {
  const command = CompleteTaskUcDef.command({ taskId: TASK });

  test('Ok и ошибка контракта UC восстанавливаются, без warn', () => {
    const logs: LogRecord[] = [];
    const todo = api(logs);
    const error = TaskErrors.ALREADY_DONE.err();
    const wire = overJson(CompleteTaskUcDef.serializeResult(error));

    expect(todo.restore(command, { ok: true, value: {} })).toEqual(ok({}));
    expect(todo.restore(command, wire)).toEqual(error);
    expect(logs).toEqual([]);
  });

  test('код вне контракта — SERVER_INTERNAL и warn с исходным кодом', () => {
    const logs: LogRecord[] = [];
    const wire: SerializedResult = {
      ok: false,
      error: { code: 'ALIEN_CODE', kind: 'conflict' },
    };

    expect(api(logs).restore(command, wire)).toEqual(
      CoreErrors.SERVER_INTERNAL.err(),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe('warn');
    expect(logs[0]?.message).toContain('ALIEN_CODE');
    expect(logs[0]?.source).toBe('todo.completeTask');
  });

  test('payload не проходит схему — SERVER_INTERNAL и warn', () => {
    const logs: LogRecord[] = [];
    const wire: SerializedResult = {
      ok: false,
      error: { code: 'TASK_NOT_FOUND', kind: 'not_found', payload: {} },
    };

    expect(api(logs).restore(command, wire)).toEqual(
      CoreErrors.SERVER_INTERNAL.err(),
    );
    expect(logs[0]?.message).toContain('TASK_NOT_FOUND');
  });

  test('SERVER_INTERNAL с сервера — как есть, без warn', () => {
    const logs: LogRecord[] = [];
    const wire = overJson(
      CompleteTaskUcDef.serializeResult(CoreErrors.SERVER_INTERNAL.err()),
    );

    expect(api(logs).restore(command, wire)).toEqual(
      CoreErrors.SERVER_INTERNAL.err(),
    );
    expect(logs).toEqual([]);
  });

  test('восстановленный Result типизирован по Def команды', () => {
    const restored = api().restore(command, { ok: true, value: {} });
    type Complete = typeof CompleteTaskUcDef;
    expectTypeOf(restored).toEqualTypeOf<
      Result<OutputOf<Complete>, UseCaseErrorOf<Complete>>
    >();
  });
});

function overJson(value: unknown): SerializedResult {
  return JSON.parse(JSON.stringify(value));
}
