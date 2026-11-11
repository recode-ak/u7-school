import type { ReadonlyAr } from 'dmg-core';
import { UserAr, type UserView } from './user/user.ar';
import { stored } from './user/user.fixture';

/**
 * Субъект `UserAr` для тестов вне модуля `user`: права Policy спрашиваются у
 * агрегата (`isMentor()`/`isAdmin()`), а не у поля `roles`. Поля записи —
 * дефолты `stored()`, `uuid` и роли задаёт вызывающий. Импорт `…/testing`
 * разрешён только тестовому коду (TST-07).
 */
export function userSubject(
  init: { uuid: string; roles: UserView['roles'] } & Partial<UserView>,
): ReadonlyAr<UserAr> {
  return UserAr.restore(stored(init));
}
