import type { ApiApp } from '#api-legacy/index';
import type { AppMeta } from '#domain-legacy/types';
import type { UiAppResolve } from '#ui-legacy/types';

/**
 * Зависимости UI-слоя бота.
 */
export interface BotUiAppResolve<
  TAppMeta extends AppMeta = AppMeta,
  TActor = unknown,
> extends UiAppResolve {
  /** Резолвер актора по Telegram ID */
  actorResolver: (tgId: number) => Promise<TActor>;
  appApi: ApiApp<TAppMeta>;
}
