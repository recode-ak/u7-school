import { describe, expect, test } from 'bun:test';
import { ConsoleLogger } from './console-logger';
import type { LogConsole, LogLevel } from './console-logger.types';

/** Подмена `console`: строки по методу. */
class FakeConsole implements LogConsole {
  readonly lines: { method: LogLevel; line: string }[] = [];
  debug = (line: string) => this.lines.push({ method: 'debug', line });
  info = (line: string) => this.lines.push({ method: 'info', line });
  warn = (line: string) => this.lines.push({ method: 'warn', line });
  error = (line: string) => this.lines.push({ method: 'error', line });
}

function writeAll(logger: ConsoleLogger): void {
  logger.debug('s', 'd');
  logger.info('s', 'i');
  logger.warn('s', 'w');
  logger.error('s', 'e');
}

describe('ConsoleLogger', () => {
  test('по умолчанию порог info: debug не пишется', () => {
    const out = new FakeConsole();
    writeAll(new ConsoleLogger({ console: out }));
    expect(out.lines.map((l) => l.method)).toEqual(['info', 'warn', 'error']);
  });

  test('порог уровня — опция конструктора', () => {
    const debug = new FakeConsole();
    writeAll(new ConsoleLogger({ level: 'debug', console: debug }));
    expect(debug.lines.map((l) => l.method)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ]);
    const warn = new FakeConsole();
    writeAll(new ConsoleLogger({ level: 'warn', console: warn }));
    expect(warn.lines.map((l) => l.method)).toEqual(['warn', 'error']);
  });

  test('формат строки: уровень, источник, сообщение; meta — JSON в конце', () => {
    const out = new FakeConsole();
    const logger = new ConsoleLogger({ console: out });
    logger.info('todo', 'задача создана');
    logger.error('event-bus', 'сбой', { event: 'todo.task.created', n: 1 });
    expect(out.lines).toEqual([
      { method: 'info', line: '[info] todo: задача создана' },
      {
        method: 'error',
        line: '[error] event-bus: сбой {"event":"todo.task.created","n":1}',
      },
    ]);
  });

  test('несериализуемая meta не роняет запись', () => {
    const out = new FakeConsole();
    const meta: Record<string, unknown> = {};
    meta.self = meta;
    new ConsoleLogger({ console: out }).warn('s', 'm', meta);
    expect(out.lines).toEqual([
      { method: 'warn', line: '[warn] s: m [meta не сериализуется]' },
    ]);
  });
});
