import type { School, U7CallerResolver } from '@u7-scl/app';
import type { BotUiAppResolve } from '@u7-scl/core/ui';
import type { UserAr } from '@u7-scl/domain/user/contract';
import type { ReadonlyAr, UserCaller } from 'dmg-core';
//
// ================= UI layer ===================

/**
 * Актор бота: зарегистрированный пользователь. Регистрацию гарантирует
 * `ensureRegisteredGuest` на `/start` и входе в группу.
 */
export type U7BotActor = UserCaller<ReadonlyAr<UserAr>>;

/**
 * Зависимости UI-слоя u7-бота: базовый резолв ядра + идемпотентная
 * гост-регистрация на /start (от имени системного актора-бота).
 */
export interface U7BotUiAppResolve extends BotUiAppResolve<U7BotActor> {
  /** uuid системного актора-бота (BOT_ADMIN_UUID) — регистрация гостя и роли от его имени */
  botAdminUuid: string;
  /** сущность школы (FR-4) */
  school: School;
  /** резолвер `Caller` приложения (D-50): субъект команд DMG из `dispatchUc` */
  callers: Pick<U7CallerResolver, 'resolve'>;
  /** telegramId администраторов для админ-команд (/log_level и др.) (FR-4) */
  adminTelegramIds?: number[];
}
