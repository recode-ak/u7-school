import { describe, expect, it } from 'bun:test';
import { CoreErrors } from './core-errors';

describe('CoreErrors', () => {
  it('базовые ошибки ядра с закреплёнными кодами и kind', () => {
    const pairs = Object.values(CoreErrors).map((d) => [d.code, d.kind]);
    expect(pairs).toEqual([
      ['UNAUTHORIZED', 'unauthorized'],
      ['INPUT_VALIDATION', 'validation'],
      ['ACCESS_DENIED', 'access'],
      ['OUTPUT_VALIDATION', 'internal'],
      ['VERSION_CONFLICT', 'conflict'],
      ['SERVER_INTERNAL', 'internal'],
    ]);
  });

  it('ACCESS_DENIED несёт правило и denyMessage', () => {
    const error = CoreErrors.ACCESS_DENIED.make({
      rule: 'todo.owner',
      denyMessage: 'Только автор задачи',
    });
    expect(error.payload.rule).toBe('todo.owner');
  });

  it('UNAUTHORIZED несёт только вид вызывающего (D-43, Р7)', () => {
    const error = CoreErrors.UNAUTHORIZED.make({ callerKind: 'guest' });
    expect(error.payload).toEqual({ callerKind: 'guest' });
    expect(Object.keys(CoreErrors.UNAUTHORIZED.payload.entries)).toEqual([
      'callerKind',
    ]);
    CoreErrors.UNAUTHORIZED.make({
      callerKind: 'system',
      // @ts-expect-error `calls` проверяет тип — `from` в отказе не нужен
      from: 'notes.notifyTodo',
    });
  });

  it('INPUT_VALIDATION несёт список проблем', () => {
    const error = CoreErrors.INPUT_VALIDATION.make({
      issues: [{ path: 'title', message: 'обязательно' }],
    });
    expect(error.payload.issues).toHaveLength(1);
  });
});
