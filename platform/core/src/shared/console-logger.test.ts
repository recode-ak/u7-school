import { afterEach, describe, expect, test } from 'bun:test';
import { ConsoleLogger } from './console-logger';
import { LogLevel } from './logger';

describe('ConsoleLogger — уровень по умолчанию', () => {
  const initial = ConsoleLogger.defaultLevel;
  afterEach(() => {
    ConsoleLogger.defaultLevel = initial;
  });

  test('новый логгер берёт уровень по умолчанию', () => {
    ConsoleLogger.defaultLevel = LogLevel.ERROR;
    expect(new ConsoleLogger().getLogLevel()).toBe(LogLevel.ERROR);
  });

  test('смена умолчания не трогает уже созданные логгеры', () => {
    ConsoleLogger.defaultLevel = LogLevel.DEBUG;
    const logger = new ConsoleLogger();
    ConsoleLogger.defaultLevel = LogLevel.WARN;
    expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
  });
});
