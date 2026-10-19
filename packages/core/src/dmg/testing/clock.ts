import { freezeClock, unfreezeClock } from '../time/now';
import type { Timestamp } from '../time/timestamp';

/** Заморозить `now()` на моменте `at`. */
export function setNow(at: Timestamp): void {
  freezeClock(at);
}

/** Вернуть `now()` к системным часам — в `afterEach`. */
export function resetNow(): void {
  unfreezeClock();
}
