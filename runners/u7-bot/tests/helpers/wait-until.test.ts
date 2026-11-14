import { describe, expect, test } from 'bun:test';
import { waitUntil } from './wait-until';

describe('waitUntil', () => {
  test('возвращается, когда проба становится истинной', async () => {
    let n = 0;
    await waitUntil(() => ++n >= 3);
    expect(n).toBe(3);
  });

  test('поддерживает async-пробу', async () => {
    let done = false;
    setTimeout(() => {
      done = true;
    }, 30);
    await waitUntil(async () => done);
    expect(done).toBe(true);
  });

  test('при таймауте не бросает', async () => {
    const started = Date.now();
    await waitUntil(() => false, 100);
    expect(Date.now() - started).toBeGreaterThanOrEqual(90);
  });
});
