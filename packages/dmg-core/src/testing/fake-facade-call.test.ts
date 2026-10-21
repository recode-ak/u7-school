import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { requestTrace } from '#core/app/trace';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import {
  type AnyUseCaseDef,
  defineUseCase,
} from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/policy';
import type { CallContext } from '#core/kernel/caller/call-context';
import { SystemCaller, UserCaller } from '#core/kernel/caller/caller';
import { BaseEntityFields } from '#core/kernel/fields/fields';
import { ok } from '#core/kernel/result/result';
import {
  CreateTaskUcDef,
  GetTaskUcDef,
  TaskErrors,
} from '#core/testing/example/todo/index';
import { expectErr, expectOk } from './expect-result';
import { fakeFacadeCall } from './fake-facade-call';

// Операция модуля-потребителя: объявляет (или нет) UC todo в `calls`.
const DigestArDef = defineAggregate({
  name: 'digest',
  label: 'Сводка',
  description: 'Сводка по задачам — агрегат модуля-потребителя.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

const spec = {
  name: 'showTask',
  label: 'Показать задачу',
  description: 'Читает задачу через фасад todo.',
  type: 'query',
  aggregate: DigestArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({}),
  output: v.object({}),
  errors: [],
} as const;

const Declared = defineUseCase({
  ...spec,
  calls: [GetTaskUcDef, CreateTaskUcDef],
});
const Undeclared = defineUseCase({ ...spec, name: 'sneaky' });

const callFrom = (from: AnyUseCaseDef): CallContext => ({
  caller: new SystemCaller(
    { kind: 'useCase', module: 'digest', name: from.name },
    new UserCaller({ uuid: 'u-1' }),
  ),
  calls: from.calls ?? [],
  trace: requestTrace({ requestId: 'r-1' }),
});

describe('fakeFacadeCall', () => {
  it('UC объявлен в calls — ответ фейка с аргументами метода и контекстом', async () => {
    const seen: unknown[] = [];
    const getTask = fakeFacadeCall(
      GetTaskUcDef,
      (call: CallContext, taskId: string) => {
        seen.push(call.caller.from.name, taskId);
        return ok({ taskId });
      },
    );
    const res = await getTask(callFrom(Declared), 't-1');
    expect(expectOk(res)).toEqual({ taskId: 't-1' });
    expect(seen).toEqual(['showTask', 't-1']);
  });

  it('ответ фейка — Promise: отдаётся как есть, ошибка UC тоже', async () => {
    const getTask = fakeFacadeCall(GetTaskUcDef, async () =>
      TaskErrors.NOT_FOUND.err({ taskId: 't-2' }),
    );
    const res = await getTask(callFrom(Declared));
    expect(expectErr(res, 'TASK_NOT_FOUND').payload).toEqual({
      taskId: 't-2',
    });
  });

  it('UC не объявлен в calls — UNAUTHORIZED как у callUseCase, фейк не вызван', async () => {
    let called = false;
    const getTask = fakeFacadeCall(GetTaskUcDef, () => {
      called = true;
      return ok({});
    });
    const res = await getTask(callFrom(Undeclared));
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
      from: 'sneaky',
    });
    expect(called).toBe(false);
  });

  it('у UC нет system в callers — UNAUTHORIZED без from, фейк не вызван', async () => {
    let called = false;
    const createTask = fakeFacadeCall(CreateTaskUcDef, () => {
      called = true;
      return ok({});
    });
    const res = await createTask(callFrom(Declared));
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
    expect(called).toBe(false);
  });
});
