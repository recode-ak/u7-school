/** Запись `MemoryLogger`. */
export type LogRecord = {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly source: string;
  readonly message: string;
};
