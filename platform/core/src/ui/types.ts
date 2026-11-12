import type { EventBus } from 'dmg-core/app';

/**
 * Разрешает зависимости уровня UI-приложения.
 */
export interface UiAppResolve {
  eventBus: EventBus;
}
