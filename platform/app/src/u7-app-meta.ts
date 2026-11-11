import type { U7ApiApp } from '@u7-scl/app-legacy/domain';
import type { AppMeta } from '@u7-scl/core/domain';
import type { UserApiModuleMeta } from '@u7-scl/user/domain';

/**
 * Метаданные legacy API-приложения U7 Bot: из legacy-модулей в нём остался
 * только `user`.
 */
export interface U7BotAppMeta extends AppMeta {
  name: 'u7-bot-app';
  moduleMetas: UserApiModuleMeta;
}

/** Тип API-приложения U7 бота (актор закрыт на User в модуле app) */
export type U7BotApp = U7ApiApp<U7BotAppMeta>;
