import type { Result } from '../result/result';

type Coded = { readonly code: string };

/**
 * Проверяет, что `res` — отказ с кодом `code`, и возвращает ошибку,
 * суженную по типу. Не зависит от тест-раннера: при несовпадении бросает.
 */
export function expectErr<E extends Coded, C extends E['code']>(
  res: Result<unknown, E>,
  code: C,
): Extract<E, { readonly code: C }> {
  if (res.ok) {
    throw new Error(`ожидалась ошибка ${code}, получен Ok`);
  }
  if (!hasCode(res.error, code)) {
    throw new Error(`ожидалась ошибка ${code}, получена ${res.error.code}`);
  }
  return res.error;
}

function hasCode<E extends Coded, C extends E['code']>(
  error: E,
  code: C,
): error is Extract<E, { readonly code: C }> {
  return error.code === code;
}
