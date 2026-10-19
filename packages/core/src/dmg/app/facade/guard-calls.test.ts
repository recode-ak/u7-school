import { describe, expect, test } from 'bun:test';
import { defineFacade } from '../../domain/contracts/define-facade';
import { TaskErrors, TodoFacade } from '../../testing/example/todo';
import { guardCalls } from './guard-calls';
import { implementFacade } from './implement-facade';

const OtherFacade = defineFacade({
  name: 'other',
  label: 'Другой',
  description: 'Фасад, который не заявлен в calls.',
  methods: {},
});

const todo = implementFacade(TodoFacade, {
  getTask: async (taskId) => TaskErrors.NOT_FOUND.err({ taskId }),
});

const deps = {
  todo,
  other: implementFacade(OtherFacade, {}),
  plain: { value: 1 },
};

describe('guardCalls', () => {
  test('заявленный фасад и не-фасады доступны', () => {
    const guarded = guardCalls('er', [TodoFacade], deps);
    expect(guarded.todo).toBe(todo);
    expect(guarded.plain.value).toBe(1);
  });

  test('незаявленный фасад — исключение с именем владельца', () => {
    const guarded = guardCalls('er', [TodoFacade], deps);
    expect(() => guarded.other).toThrow('er: фасад other не заявлен в calls');
  });
});
