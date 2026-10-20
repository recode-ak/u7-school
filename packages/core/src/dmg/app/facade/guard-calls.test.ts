import { describe, expect, test } from 'bun:test';
import { defineFacade } from '#dmg/domain/contracts/define-facade';
import { TaskErrors, TodoFacadeDef } from '#dmg/testing/example/todo/index';
import { guardCalls } from './guard-calls';
import { implementFacade } from './implement-facade';

const OtherFacadeDef = defineFacade({
  name: 'other',
  label: 'Другой',
  description: 'Фасад, который не заявлен в calls.',
  methods: {},
});

const todo = implementFacade(TodoFacadeDef, {
  getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
});

const deps = {
  todo,
  other: implementFacade(OtherFacadeDef, {}),
  plain: { value: 1 },
};

describe('guardCalls', () => {
  test('заявленный фасад и не-фасады доступны', () => {
    const guarded = guardCalls('er', [TodoFacadeDef], deps);
    expect(guarded.todo).toBe(todo);
    expect(guarded.plain.value).toBe(1);
  });

  test('незаявленный фасад — исключение с именем владельца', () => {
    const guarded = guardCalls('er', [TodoFacadeDef], deps);
    expect(() => guarded.other).toThrow('er: фасад other не заявлен в calls');
  });
});
