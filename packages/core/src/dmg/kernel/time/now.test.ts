import { afterEach, describe, expect, it } from 'bun:test';
import { resetNow, setNow } from '#dmg/testing/clock';
import { now } from './now';

afterEach(() => resetNow());

describe('now', () => {
  it('по умолчанию — системные часы, мс UTC', () => {
    const before = Date.now();
    const value = now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Date.now());
  });

  it('setNow замораживает время, resetNow возвращает часы', () => {
    setNow(1_000);
    expect(now()).toBe(1_000);
    resetNow();
    expect(now()).toBeGreaterThan(1_000);
  });
});
