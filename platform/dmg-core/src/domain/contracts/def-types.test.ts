// Тесты типов Def (трек dmg-core-oop, спека п.2): что должно сохраниться
// при переходе Def на классы. Первая часть фиксирует поведение текущего DSL
// (`define*`), вторая — то же на прототипе `XxxDef.define`.
import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { allowAll } from '../policy/policy';
import {
  CompleteTaskUcDef,
  type GetUserUcDef,
  type ListTasksUcDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoModuleDef,
  UserArDef,
} from './contracts.fixture';
import {
  type AnyProtoUseCaseDef,
  ProtoUseCaseDef,
} from './def-prototype.fixture';
import type { AnyUseCaseDef, InputOf } from './define-use-case';

describe('типы Def: текущий DSL', () => {
  it('литеральные типы calls, policy, useCases, InputOf', () => {
    expectTypeOf<(typeof CompleteTaskUcDef)['calls'][number]>().toEqualTypeOf<
      typeof GetUserUcDef
    >();
    expectTypeOf<(typeof CompleteTaskUcDef)['policy']>().toEqualTypeOf<
      typeof TaskPolicy.rules.canComplete
    >();
    expectTypeOf<(typeof TodoModuleDef)['useCases'][number]>().toEqualTypeOf<
      typeof CompleteTaskUcDef | typeof ListTasksUcDef
    >();
    expectTypeOf<InputOf<typeof CompleteTaskUcDef>>().toEqualTypeOf<{
      taskId: string;
    }>();
  });

  it('конкретный Def совместим с Any*Def', () => {
    expectTypeOf<typeof CompleteTaskUcDef>().toExtend<AnyUseCaseDef>();
  });

  it('сравнение по ссылке: includes и ключи Map', () => {
    const list: readonly AnyUseCaseDef[] = TodoModuleDef.useCases;
    expect(list.includes(CompleteTaskUcDef)).toBe(true);
    const byDef = new Map<AnyUseCaseDef, string>([[CompleteTaskUcDef, 'c']]);
    expect(byDef.get(CompleteTaskUcDef)).toBe('c');
  });
});

/** Def прототипа с вызовом другого UC — как `CompleteTaskUcDef`. */
const ProtoGetUser = ProtoUseCaseDef.define({
  name: 'getUser',
  label: 'Пользователь',
  description: 'Учётная запись по идентификатору.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ userId: v.string() }),
  output: v.object({ userId: v.string() }),
  errors: [],
});

const ProtoComplete = ProtoUseCaseDef.define({
  name: 'completeTask',
  label: 'Завершить задачу',
  description: 'Отмечает задачу выполненной.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user'],
  policy: TaskPolicy.rules.canComplete,
  calls: [ProtoGetUser],
  input: v.object({ taskId: v.string() }),
  output: v.object({}),
  errors: [TaskErrors.NOT_FOUND],
  emits: [TaskEvents.completed],
});

const ProtoList = ProtoUseCaseDef.define({
  name: 'listTasks',
  label: 'Список задач',
  description: 'Все задачи пользователя.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({}),
  output: v.object({}),
  errors: [],
});

describe('типы Def: прототип XxxDef.define', () => {
  it('экземпляр класса с дискриминатором', () => {
    expect(ProtoComplete).toBeInstanceOf(ProtoUseCaseDef);
    expect(ProtoComplete.dmg).toBe('useCase');
    expect(ProtoComplete.policy).toBe(TaskPolicy.rules.canComplete);
  });

  it('литеральные типы calls, policy, InputOf', () => {
    expectTypeOf<(typeof ProtoComplete)['calls'][number]>().toEqualTypeOf<
      typeof ProtoGetUser
    >();
    expectTypeOf<(typeof ProtoComplete)['policy']>().toEqualTypeOf<
      typeof TaskPolicy.rules.canComplete
    >();
    expectTypeOf<
      v.InferInput<(typeof ProtoComplete)['input']>
    >().toEqualTypeOf<{
      taskId: string;
    }>();
  });

  it('calls не объявлены — пустой кортеж, нормализован в конструкторе', () => {
    expectTypeOf<(typeof ProtoList)['calls']>().toEqualTypeOf<readonly []>();
    expect(ProtoList.calls).toEqual([]);
  });

  it('calls — только UC с system в callers (D-43)', () => {
    ProtoUseCaseDef.define({
      name: 'x',
      label: 'x',
      description: 'x',
      type: 'query',
      aggregate: TaskArDef,
      callers: ['user'],
      policy: allowAll,
      // @ts-expect-error ProtoList зовёт только user — система его не вызовет
      calls: [ProtoList],
      input: v.object({}),
      output: v.object({}),
      errors: [],
    });
  });

  it('конкретный Def совместим с Any; структурная типизация', () => {
    expectTypeOf<typeof ProtoComplete>().toExtend<AnyProtoUseCaseDef>();
    // Нет private/#: тип из одних публичных членов (так выглядит Def из
    // другой копии пакета) совместим с самим классом.
    type PublicShape = { [K in keyof ProtoUseCaseDef]: ProtoUseCaseDef[K] };
    expectTypeOf<PublicShape>().toExtend<ProtoUseCaseDef>();
  });

  it('сравнение по ссылке: includes и ключи Map', () => {
    const list: readonly AnyProtoUseCaseDef[] = [ProtoComplete, ProtoList];
    expect(list.includes(ProtoComplete)).toBe(true);
    const byDef = new Map<AnyProtoUseCaseDef, string>([[ProtoList, 'l']]);
    expect(byDef.get(ProtoList)).toBe('l');
  });
});
