import { describe, expect, test } from 'bun:test';
import { CoreErrors } from 'dmg-core';
import { TaskErrors } from 'dmg-core/testing/example/todo/index';
import { toLegacyError } from './legacy-error';

// Сценарии перенесены из тестов `ApiApp.execute(Def)` (удалён в
// command-dispatch): stories показывают отказ DMG веткой legacy (DEBT-37).
describe('toLegacyError', () => {
  test('ошибка Def: код → имя, kind → legacy-kind, текст — label', () => {
    expect(
      toLegacyError(TaskErrors.NOT_FOUND.make({ taskId: 't-1' })),
    ).toMatchObject({
      name: 'TASK_NOT_FOUND',
      kind: 'not-found',
      level: 'domain',
      message: 'Задача не найдена',
      payload: { taskId: 't-1' },
    });
  });

  test('ACCESS_DENIED — текст отказа правила (denyMessage)', () => {
    expect(
      toLegacyError(
        CoreErrors.ACCESS_DENIED.make({
          rule: 'isOwner',
          denyMessage: 'Управлять задачей может владелец.',
        }),
      ),
    ).toMatchObject({
      name: 'ACCESS_DENIED',
      kind: 'access-denied',
      message: 'Управлять задачей может владелец.',
    });
  });

  test('unauthorized — уровень api', () => {
    expect(
      toLegacyError(CoreErrors.UNAUTHORIZED.make({ callerKind: 'system' }))
        .level,
    ).toBe('api');
  });
});
