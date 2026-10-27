import type { Logger } from '../context';
import type {
  ConsoleLoggerOptions,
  LogConsole,
  LogLevel,
} from './console-logger.types';

export type {
  ConsoleLoggerOptions,
  LogConsole,
  LogLevel,
} from './console-logger.types';

/** Порядок уровней: запись пишется, если её ранг не ниже порога. */
const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Логгер в `console`: одна строка `[уровень] источник: сообщение`, `meta` —
 * JSON в конце строки. Метку времени не ставит — её добавляет окружение
 * (pm2, journald).
 */
export class ConsoleLogger implements Logger {
  private readonly threshold: number;
  private readonly out: LogConsole;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.threshold = RANK[options.level ?? 'info'];
    this.out = options.console ?? console;
  }

  debug(source: string, message: string, meta?: Record<string, unknown>): void {
    this.write('debug', source, message, meta);
  }

  info(source: string, message: string, meta?: Record<string, unknown>): void {
    this.write('info', source, message, meta);
  }

  warn(source: string, message: string, meta?: Record<string, unknown>): void {
    this.write('warn', source, message, meta);
  }

  error(source: string, message: string, meta?: Record<string, unknown>): void {
    this.write('error', source, message, meta);
  }

  private write(
    level: LogLevel,
    source: string,
    message: string,
    meta: Record<string, unknown> | undefined,
  ): void {
    if (RANK[level] < this.threshold) return;
    const line = `[${level}] ${source}: ${message}`;
    this.out[level](meta === undefined ? line : `${line} ${this.json(meta)}`);
  }

  /** Логгер не бросает: несериализуемая `meta` заменяется пометкой. */
  private json(meta: Record<string, unknown>): string {
    try {
      return JSON.stringify(meta);
    } catch {
      return '[meta не сериализуется]';
    }
  }
}
