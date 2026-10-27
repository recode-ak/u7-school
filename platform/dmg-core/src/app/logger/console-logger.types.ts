/** Уровень записи логгера. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Куда пишет `ConsoleLogger`: по умолчанию глобальный `console`. */
export type LogConsole = {
  debug(line: string): void;
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
};

/** Опции `ConsoleLogger`. */
export type ConsoleLoggerOptions = {
  /** Порог: записи ниже уровня не пишутся. По умолчанию `info`. */
  readonly level?: LogLevel;
  /** Подмена `console` (тесты, перенаправление). */
  readonly console?: LogConsole;
};
