import { describe, expect, it } from 'bun:test';
import { err, ok, type Result } from './result';

type Failure = { code: 'A_FAILED' } | { code: 'B_FAILED'; reason: string };

function divide(a: number, b: number): Result<number, Failure> {
  return b === 0 ? err({ code: 'B_FAILED', reason: 'zero' }) : ok(a / b);
}

describe('ok', () => {
  it('несёт значение', () => {
    const res = ok(42);
    expect(res).toEqual({ ok: true, value: 42 });
  });

  it('без аргумента — Ok<void>', () => {
    const res: Result<void, Failure> = ok();
    expect(res.ok).toBe(true);
  });
});

describe('err', () => {
  it('несёт ошибку', () => {
    expect(err({ code: 'A_FAILED' })).toEqual({
      ok: false,
      error: { code: 'A_FAILED' },
    });
  });
});

describe('сужение по res.ok', () => {
  it('Ok даёт value, Err — error', () => {
    const good = divide(6, 3);
    const bad = divide(1, 0);
    expect(good.ok ? good.value : undefined).toBe(2);
    expect(bad.ok ? undefined : bad.error.code).toBe('B_FAILED');
  });
});
