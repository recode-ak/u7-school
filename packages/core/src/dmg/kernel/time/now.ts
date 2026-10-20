import type { Timestamp } from './timestamp';

let frozen: Timestamp | undefined;
let source: () => Timestamp = () => Date.now();

/**
 * Текущий момент — единственная точка чтения часов в коде DMG.
 * Источник по умолчанию — системные часы; потребитель подменяет его
 * через `useClockSource`.
 */
export function now(): Timestamp {
  return frozen ?? source();
}

/** Подключить источник времени (мс UTC); без аргумента — системные часы. */
export function useClockSource(next?: () => Timestamp): void {
  source = next ?? (() => Date.now());
}

/** Заморозить часы (только для тестов, см. `dmg/testing`). */
export function freezeClock(at: Timestamp): void {
  frozen = at;
}

/** Вернуть системные часы. */
export function unfreezeClock(): void {
  frozen = undefined;
}
