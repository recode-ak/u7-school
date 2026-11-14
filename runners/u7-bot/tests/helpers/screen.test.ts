import { describe, expect, test } from 'bun:test';
import { mdRaw } from '@u7-scl/core/shared';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Screen } from './screen';

const response: DialogResponse = {
  screen: {
    text: mdRaw('Экран'),
    keyboard: {
      rows: [
        [
          { text: 'Первая', code: 'a:b:one' },
          { text: 'Вторая', code: 'a:b:two' },
        ],
        [{ text: 'Третья', code: 'a:b:three' }],
      ],
      isMultiple: false,
    },
  },
};

describe('Screen', () => {
  test('buttons/texts/codes — плоский список кнопок экрана', () => {
    const screen = Screen.of(response);
    expect(screen.buttons()).toHaveLength(3);
    expect(screen.texts()).toEqual(['Первая', 'Вторая', 'Третья']);
    expect(screen.codes()).toEqual(['a:b:one', 'a:b:two', 'a:b:three']);
  });

  test('button(textContains) — первая кнопка с фрагментом', () => {
    expect(Screen.of(response).button('Втор').code).toBe('a:b:two');
  });

  test('button: нет кнопки — «Кнопка «…» не найдена»', () => {
    expect(() => Screen.of(response).button('Нет')).toThrow(
      'Кнопка «Нет» не найдена',
    );
  });

  test('ответ без экрана или клавиатуры — пустые списки', () => {
    expect(Screen.of({}).buttons()).toEqual([]);
    expect(Screen.of({ screen: { text: mdRaw('x') } }).codes()).toEqual([]);
  });
});
