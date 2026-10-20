import type { Timestamp } from '#core/kernel/time/timestamp';
import type { EventBus } from './events/event-bus';

/** Режим запуска приложения. */
export type AppMode = 'test' | 'development' | 'production';

/** Порт логгера: платформе нужны только записи, уровнями управляет потребитель. */
export type Logger = {
  debug(source: string, message: string, meta?: Record<string, unknown>): void;
  info(source: string, message: string, meta?: Record<string, unknown>): void;
  warn(source: string, message: string, meta?: Record<string, unknown>): void;
  error(source: string, message: string, meta?: Record<string, unknown>): void;
};

/**
 * Часы приложения: текущий момент (мс UTC). Читает только прикладной слой;
 * домен получает время аргументом операции (D-34).
 */
export type Clock = () => Timestamp;

/** Системные часы. */
export const systemClock: Clock = () => Date.now();

/** Платформенные зависимости приложения, общие для всех модулей DMG. */
export type AppContext = {
  readonly bus: EventBus;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly mode: AppMode;
};

/** Резолвер модуля DMG: модуль расширяет его репозиториями и фасадами. */
export type ModuleDeps = { readonly app: AppContext };
