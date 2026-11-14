import type { Identified, PersonCaller } from 'dmg-core';
import type { ApiApp } from 'dmg-core/app';
import type { UiAppResolve } from '../types';

/**
 * Зависимости UI-слоя бота.
 */
export interface BotUiAppResolve<TActor extends PersonCaller = PersonCaller>
  extends UiAppResolve {
  /** Резолвер актора по Telegram ID; `null` — у человека нет записи пользователя (F-40). */
  actorResolver: (tgId: number) => Promise<TActor | null>;
  appApi: ApiApp<Identified>;
}
