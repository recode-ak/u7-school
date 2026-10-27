import { describe, expect, test } from 'bun:test';
import type { Logger } from '../app/context';
import { type LogRecord, MemoryLogger } from './memory-logger';

describe('MemoryLogger', () => {
  test('складывает записи всех уровней по порядку', () => {
    const logger = new MemoryLogger();
    // Приложение видит его как `Logger`: `meta` принимается, но не хранится.
    const app: Logger = logger;
    app.error('b', 'ошибка', { code: 1 });
    logger.debug('a', 'отладка');
    logger.info('a', 'сведения');
    logger.warn('b', 'предупреждение');
    expect(logger.records).toEqual([
      { level: 'error', source: 'b', message: 'ошибка' },
      { level: 'debug', source: 'a', message: 'отладка' },
      { level: 'info', source: 'a', message: 'сведения' },
      { level: 'warn', source: 'b', message: 'предупреждение' },
    ]);
  });

  test('пишет в переданный массив', () => {
    const records: LogRecord[] = [];
    new MemoryLogger(records).info('x', 'сообщение');
    expect(records).toEqual([
      { level: 'info', source: 'x', message: 'сообщение' },
    ]);
  });
});
