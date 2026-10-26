import { afterEach, expect, spyOn, test } from 'bun:test';
import * as Shared from '#shared-legacy/now';
import { legacyClock } from './legacy-clock';

let spyOnNow: ReturnType<typeof spyOn> | undefined;

afterEach(() => {
  spyOnNow?.mockRestore();
});

test('часы DMG читают legacy now — заморозка времени legacy действует и на DMG', () => {
  const at = new Date(Date.UTC(2026, 9, 20, 12, 0));
  spyOnNow = spyOn(Shared, 'now').mockReturnValue(at);
  expect(legacyClock()()).toBe(at.getTime());
});
