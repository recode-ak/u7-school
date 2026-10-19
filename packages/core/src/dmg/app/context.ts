import type { AppEnvMode } from '#domain/types';
import type { Logger } from '#shared/logger';
import type { EventBus } from './events/event-bus';

/** Платформенные зависимости приложения, общие для всех модулей DMG. */
export type AppContext = {
  readonly bus: EventBus;
  readonly logger: Logger;
  readonly mode: AppEnvMode;
};

/** Резолвер модуля DMG: модуль расширяет его репозиториями и фасадами. */
export type ModuleDeps = { readonly app: AppContext };
