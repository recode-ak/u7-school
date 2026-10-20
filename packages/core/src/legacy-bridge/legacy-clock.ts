import type { Clock } from 'dmg-core/app';
import { now } from '#shared-legacy/now';

/**
 * Часы DMG поверх legacy `shared/now`: `spyOn(Shared, 'now')` замораживает
 * время и в DMG. Передаётся в `AppContext.clock` при сборке приложения.
 */
export function legacyClock(): Clock {
  return () => now().getTime();
}
