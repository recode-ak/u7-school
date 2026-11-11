import { describe, expect, test } from 'bun:test';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import type { DomainError } from 'dmg-core';
import { buttonsOf, useMockLogger } from './questionnaire-dmg.test-kit';
import { ucErrorScreen } from './render';

/**
 * `ucErrorScreen` — экран отказа UC DMG с кнопкой «⬅️ Меню» (аналог
 * `handleError` для `Result`): ветви по `kind`, не по тексту.
 */

const MENU_ROW = [['⬅️ Меню', 'app:main-menu']];

const error = (
  kind: DomainError['kind'],
  label: string,
  payload: unknown = {},
): DomainError => ({
  code: 'SOME_CODE',
  kind,
  label,
  description: 'описание',
  payload,
});

describe('ucErrorScreen', () => {
  const logger = useMockLogger();

  test.each([
    ['not_found', 'Анкета не найдена'],
    ['conflict', 'Анкета уже завершена'],
  ] as const)('%s: «⚠️ label» и кнопка меню', (kind, label) => {
    const res = ucErrorScreen(error(kind, label));

    expect(String(res.screen?.text)).toBe(`⚠️ ${label}`);
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('access: denyMessage правила важнее label', () => {
    const res = ucErrorScreen(
      error('access', 'Доступ запрещён', {
        denyMessage: 'Нет доступа к анкете',
      }),
    );

    expect(String(res.screen?.text)).toContain('Нет доступа к анкете');
    expect(String(res.screen?.text)).not.toContain('Доступ запрещён');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('access без denyMessage: label', () => {
    const res = ucErrorScreen(error('access', 'Доступ запрещён'));

    expect(String(res.screen?.text)).toContain('Доступ запрещён');
  });

  test('validation с issues: перечень полей', () => {
    const res = ucErrorScreen(
      error('validation', 'Неверный ввод', {
        issues: [
          { path: 'value', message: 'не может быть пустым' },
          { path: 'questionnaireId', message: 'не uuid' },
        ],
      }),
    );

    const text = String(res.screen?.text);
    expect(text).toContain('Ошибка валидации');
    expect(text).toContain('value');
    expect(text).toContain('не может быть пустым');
    expect(text).toContain('questionnaireId');
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test('validation без issues: label', () => {
    const res = ucErrorScreen(
      error('validation', 'Код ответа не может быть пустым'),
    );

    expect(String(res.screen?.text)).toContain('Ошибка валидации');
    expect(String(res.screen?.text)).toContain(
      'Код ответа не может быть пустым',
    );
    expect(buttonsOf(res)).toEqual(MENU_ROW);
  });

  test.each(['internal', 'unauthorized'] as const)(
    '%s: общий текст без label и payload, лог ошибки, кнопка меню',
    (kind) => {
      const res = ucErrorScreen(
        error(kind, 'секретная внутренняя деталь', { dump: 'утечка' }),
      );

      const text = String(res.screen?.text);
      expect(text).not.toContain('секретная');
      expect(text).not.toContain('утечка');
      expect(logger.error).toHaveBeenCalled();
      expect(buttonsOf(res)).toEqual(MENU_ROW);
    },
  );

  test('label со спецсимволами MarkdownV2 экранируется', () => {
    const res = ucErrorScreen(
      error('conflict', 'Иванов_Иван (senior). Backend / Node.js!'),
    );

    expect(() => assertMarkdownV2Safe(String(res.screen?.text))).not.toThrow();
  });
});
