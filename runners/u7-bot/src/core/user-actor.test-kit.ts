import { userSubject } from '@u7-scl/domain/user/testing';
import { UserCaller } from 'dmg-core';
import type { U7BotActor } from './u7-bot-app-meta';

/**
 * Актор бота для тестов: `UserCaller` над субъектом `UserAr` (`userSubject`,
 * D-70). Единственная фикстура актора: stories и контроллеры получают её как
 * `U7BotActor`, поля пользователя — `actor.user.view()`/`actor.user.uuid`.
 */
export function userActor(init: Parameters<typeof userSubject>[0]): U7BotActor {
  return new UserCaller(userSubject(init));
}
