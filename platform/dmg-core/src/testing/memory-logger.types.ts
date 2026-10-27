import type { LogLevel } from '../app/logger/console-logger.types';

/** Запись `MemoryLogger`. */
export type LogRecord = {
  readonly level: LogLevel;
  readonly source: string;
  readonly message: string;
};
