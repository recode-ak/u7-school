import { describe, expect, expectTypeOf, it } from 'bun:test';
import * as v from 'valibot';
import { Def } from '../def/def';
import { toJsonSchema } from '../schema/json-schema';
import { type AnyErrorDef, ErrorDef } from './error-def';

const TodoErrors = ErrorDef.define('TODO', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Задача не найдена',
    description: 'Задачи с таким идентификатором нет.',
    payload: v.object({ todoId: v.string() }),
  },
  ALREADY_DONE: {
    kind: 'conflict',
    label: 'Задача уже выполнена',
    description: 'Повторно завершить выполненную задачу нельзя.',
  },
});

describe('ErrorDef', () => {
  it('define — группа Def-классов, код = префикс + ключ', () => {
    const def = TodoErrors.NOT_FOUND;
    expect(def).toBeInstanceOf(ErrorDef);
    expect(def).toBeInstanceOf(Def);
    expect(def.code).toBe('TODO_NOT_FOUND');
    expectTypeOf(def.code).toEqualTypeOf<'TODO_NOT_FOUND'>();
  });

  it('name — код ошибки', () => {
    expect(TodoErrors.NOT_FOUND.name).toBe('TODO_NOT_FOUND');
  });

  it('пустой префикс — код равен ключу (ошибки ядра)', () => {
    const Core = ErrorDef.define('', {
      BOOM: { kind: 'internal', label: 'л', description: 'о' },
    });
    expect(Core.BOOM.code).toBe('BOOM');
  });

  it('make()/err() — методы класса', () => {
    expect(TodoErrors.NOT_FOUND.make({ todoId: 't1' })).toEqual({
      code: 'TODO_NOT_FOUND',
      kind: 'not_found',
      label: 'Задача не найдена',
      description: 'Задачи с таким идентификатором нет.',
      payload: { todoId: 't1' },
    });
    expect(TodoErrors.ALREADY_DONE.err().error.code).toBe('TODO_ALREADY_DONE');
  });

  it('normalize() — форма графа без функций', () => {
    expect(TodoErrors.NOT_FOUND.normalize()).toEqual({
      dmg: 'error',
      code: 'TODO_NOT_FOUND',
      kind: 'not_found',
      label: 'Задача не найдена',
      description: 'Задачи с таким идентификатором нет.',
      payload: toJsonSchema(v.object({ todoId: v.string() })),
    });
    expect(TodoErrors.ALREADY_DONE.normalize().payload).toBeUndefined();
  });

  it('describe() — схема payload, если объявлена', () => {
    const found = TodoErrors.NOT_FOUND;
    expect(found.describe()).toEqual({
      label: 'Задача не найдена',
      description: 'Задачи с таким идентификатором нет.',
      schemas: [['payload', found.payload]],
    });
    expect(TodoErrors.ALREADY_DONE.describe().schemas).toEqual([]);
  });

  it('конкретный Def совместим с AnyErrorDef', () => {
    expectTypeOf(TodoErrors.NOT_FOUND).toExtend<AnyErrorDef>();
    expectTypeOf(TodoErrors.ALREADY_DONE).toExtend<AnyErrorDef>();
  });
});
