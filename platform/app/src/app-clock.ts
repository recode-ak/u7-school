import { now } from '@u7-scl/core/shared';
import type { Clock } from 'dmg-core/app';

/**
 * Часы корня сборки (D-34): единственная точка чтения системных часов —
 * `now()`, поэтому заморозка времени в тестах действует и на DMG.
 */
export const appClock: Clock = () => now().getTime();
