import type { U7BotAppMeta, U7CallerResolver } from '@u7-scl/app';
import type { User } from '@u7-scl/app-legacy';
import type { School, U7AppResolver } from '@u7-scl/app-legacy/domain';
import type { BotUiAppResolve } from '@u7-scl/core/ui';
import type { UserFacade } from '@u7-scl/user/domain';
//
// ================= UI layer ===================

/**
 * Зависимости UI-слоя u7-бота: базовый резолв ядра + идемпотентная
 * гост-регистрация на /start (от имени системного актора-бота).
 */
export interface U7BotUiAppResolve extends BotUiAppResolve<U7BotAppMeta, User> {
  /** фасад пользователей — идемпотентная гост-регистрация на /start */
  userFacade: UserFacade;
  /** системный актор-бот (BOT_ADMIN_UUID, резолвится при старте) — регистрация гостя от его имени */
  botAdminUser: User;
  /** сущность школы (FR-4) */
  school: School;
  /** резолвер `Caller` приложения (D-50): субъект команд DMG из `dispatchUc` */
  callers: Pick<U7CallerResolver, 'resolve'>;
  /** telegramId администраторов для админ-команд (/log_level и др.) (FR-4) */
  adminTelegramIds?: number[];
}

// ================= API layer ===================
// Метаданные legacy API-приложения — в корне сборки `@u7-scl/app` (D-50).
export type { U7BotApp, U7BotAppMeta } from '@u7-scl/app';

export type { U7AppResolver };
