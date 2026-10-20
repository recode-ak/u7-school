import { useClockSource } from '#dmg/index';
import { now } from '#shared-legacy/now';

/**
 * Часы DMG читают legacy `shared/now`, поэтому `spyOn(Shared, 'now')`
 * замораживает время и в DMG. Вызывается при сборке приложения.
 */
export function useLegacyClock(): void {
  useClockSource(() => now().getTime());
}
