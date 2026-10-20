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

/** Платформенные зависимости приложения, общие для всех модулей DMG. */
export type AppContext = {
  readonly bus: EventBus;
  readonly logger: Logger;
  readonly mode: AppMode;
};

/** Резолвер модуля DMG: модуль расширяет его репозиториями и фасадами. */
export type ModuleDeps = { readonly app: AppContext };
