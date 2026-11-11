import type { U7ApiApp } from '@u7-scl/app-legacy/domain';
import type { AppMeta } from '@u7-scl/core/domain';

/**
 * Метаданные legacy API-приложения U7 Bot: legacy-модулей в нём не осталось:
 * `moduleMetas` — минимальная мета, которую принимает `AppMeta` ядра, без UC
 * (`ucMetas: never`); UC идут через DMG (`dispatch`, D-49).
 */
export interface U7BotAppMeta extends AppMeta {
  name: 'u7-bot-app';
  moduleMetas: { name: 'u7-bot-app'; url: ''; ucMetas: never };
}

/** Тип API-приложения U7 бота (актор — `UserView`, `U7ApiApp`) */
export type U7BotApp = U7ApiApp<U7BotAppMeta>;
