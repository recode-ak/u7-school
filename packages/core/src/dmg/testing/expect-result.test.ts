import { describe, expect, it } from 'bun:test';
import { err, ok, type Result } from '../kernel/result/result';
import { expectErr, expectOk } from './expect-result';

type Failure = { code: 'A_FAILED' } | { code: 'B_FAILED'; reason: string };

function attempt(fail: boolean): Result<number, Failure> {
  return fail ? err({ code: 'B_FAILED', reason: 'x' }) : ok(1);
}

const failed = attempt(true);

describe('expectErr', () => {
  it('возвращает ошибку нужного кода, суженную по типу', () => {
    const error = expectErr(failed, 'B_FAILED');
    expect(error.reason).toBe('x');
  });

  it('падает на чужом коде', () => {
    expect(() => expectErr(failed, 'A_FAILED')).toThrow(
      'ожидалась ошибка A_FAILED, получена B_FAILED',
    );
  });

  it('падает на Ok', () => {
    expect(() => expectErr(attempt(false), 'A_FAILED')).toThrow(
      'ожидалась ошибка A_FAILED, получен Ok',
    );
  });

  it('не принимает код вне union ошибок', () => {
    // @ts-expect-error код не объявлен в Failure
    expect(() => expectErr(failed, 'C_FAILED')).toThrow();
  });
});

describe('expectOk', () => {
  it('возвращает значение Ok', () => {
    const value: number = expectOk(attempt(false));
    expect(value).toBe(1);
  });

  it('падает на Err с кодом ошибки', () => {
    expect(() => expectOk(attempt(true))).toThrow(
      'ожидался Ok, получена ошибка B_FAILED',
    );
  });
});
