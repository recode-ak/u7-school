import { now as systemNow } from '#shared-legacy/now';
import type { Timestamp } from './timestamp';

let frozen: Timestamp | undefined;

/**
 * Текущий момент — единственная точка чтения часов в коде DMG.
 * Опирается на legacy `shared/now`, поэтому `spyOn(Shared, 'now')` тоже действует.
 */
export function now(): Timestamp {
  return frozen ?? systemNow().getTime();
}

/** Заморозить часы (только для тестов, см. `@u7-scl/core/dmg/testing`). */
export function freezeClock(at: Timestamp): void {
  frozen = at;
}

/** Вернуть системные часы. */
export function unfreezeClock(): void {
  frozen = undefined;
}
