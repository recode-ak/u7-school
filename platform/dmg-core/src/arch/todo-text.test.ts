import { describe, expect, it } from 'bun:test';
import { TODO_TEXT } from './todo-text';

describe('TODO_TEXT', () => {
  it.each(['TODO: заполнить', 'todo:', 'Todo', 'todo', 'TODO описание'])(
    'совпадает: «%s»',
    (text) => {
      expect(TODO_TEXT.test(text)).toBe(true);
    },
  );

  it.each(['Todoist', 'TODOшка', 'todo-list', 'TODO_X', 'TODO1', 'Todo-'])(
    'не совпадает с продолжением слова: «%s»',
    (text) => {
      expect(TODO_TEXT.test(text)).toBe(false);
    },
  );

  it.each(['Сделать TODO', 'a TODO: x', ''])(
    'не совпадает, если TODO не в начале: «%s»',
    (text) => {
      expect(TODO_TEXT.test(text)).toBe(false);
    },
  );

  it('ведущие пробелы срезает вызывающий (todos() делает trim), сам шаблон — нет', () => {
    expect(TODO_TEXT.test('  TODO: x')).toBe(false);
    expect(TODO_TEXT.test('  TODO: x'.trim())).toBe(true);
  });
});
