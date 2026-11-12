import { expect, spyOn, test } from 'bun:test';
import * as Shared from './index';

test('spyOn(Shared, now) замораживает время', () => {
  const frozen = new Date('2026-01-02T03:04:05.678Z');
  const spy = spyOn(Shared, 'now').mockReturnValue(frozen);

  expect(Shared.now().toISOString()).toBe(frozen.toISOString());

  spy.mockRestore();
  expect(Shared.now().getTime()).toBeGreaterThan(frozen.getTime());
});
