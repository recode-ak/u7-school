import type { Logger } from '../app/context';
import type { LogRecord } from './memory-logger.types';

export type { LogRecord } from './memory-logger.types';

/** Логгер для тестов: складывает записи в `records` (`meta` не хранит). */
export class MemoryLogger implements Logger {
  constructor(readonly records: LogRecord[] = []) {}

  debug(source: string, message: string): void {
    this.write('debug', source, message);
  }

  info(source: string, message: string): void {
    this.write('info', source, message);
  }

  warn(source: string, message: string): void {
    this.write('warn', source, message);
  }

  error(source: string, message: string): void {
    this.write('error', source, message);
  }

  private write(
    level: LogRecord['level'],
    source: string,
    message: string,
  ): void {
    this.records.push({ level, source, message });
  }
}
