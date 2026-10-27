import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ErrorDef, type ErrorOf } from './error-def';

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

describe('ErrorDef.define', () => {
  it('код = префикс группы + ключ', () => {
    expect(TodoErrors.NOT_FOUND.code).toBe('TODO_NOT_FOUND');
    expect(TodoErrors.ALREADY_DONE.code).toBe('TODO_ALREADY_DONE');
  });

  it('Def несёт kind, label, description и схему payload', () => {
    const def = TodoErrors.NOT_FOUND;
    expect(def.dmg).toBe('error');
    expect(def.kind).toBe('not_found');
    expect(def.label).toBe('Задача не найдена');
    expect(def.description).toBe('Задачи с таким идентификатором нет.');
    expect(def.payload).toBeDefined();
  });

  it('тип схемы payload привязан к объявлению', () => {
    const schema: v.GenericSchema = TodoErrors.NOT_FOUND.payload;
    const none: undefined = TodoErrors.ALREADY_DONE.payload;
    expect(schema).toBeDefined();
    expect(none).toBeUndefined();
  });

  it('make() строит ошибку с типизированным payload', () => {
    const error = TodoErrors.NOT_FOUND.make({ todoId: 't1' });
    expect(error).toEqual({
      code: 'TODO_NOT_FOUND',
      kind: 'not_found',
      label: 'Задача не найдена',
      description: 'Задачи с таким идентификатором нет.',
      payload: { todoId: 't1' },
    });
    // @ts-expect-error payload не по схеме
    TodoErrors.NOT_FOUND.make({ id: 1 });
  });

  it('без схемы payload make() не принимает аргументов', () => {
    expect(TodoErrors.ALREADY_DONE.make().payload).toBeUndefined();
    // @ts-expect-error payload не объявлен
    TodoErrors.ALREADY_DONE.make({ x: 1 });
  });

  it('err() сразу возвращает Err', () => {
    const res = TodoErrors.ALREADY_DONE.err();
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('TODO_ALREADY_DONE');
  });

  it('ErrorOf выводит литеральный тип ошибки', () => {
    const error: ErrorOf<typeof TodoErrors.NOT_FOUND> =
      TodoErrors.NOT_FOUND.make({ todoId: 't1' });
    const code: 'TODO_NOT_FOUND' = error.code;
    expect(code).toBe('TODO_NOT_FOUND');
  });

  it('kind — закрытый набор', () => {
    ErrorDef.define('X', {
      // @ts-expect-error неизвестный kind
      BAD: { kind: 'oops', label: 'л', description: 'о' },
    });
  });

  it('label и description обязательны', () => {
    ErrorDef.define('X', {
      // @ts-expect-error нет description
      BAD: { kind: 'conflict', label: 'л' },
    });
  });
});
