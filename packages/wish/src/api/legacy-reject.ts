import { errBadRequest, throwError } from '@u7-scl/core/domain';
import type { Result } from 'dmg-core';

/**
 * Мост `Result` → legacy-исключение: отказ перехода `WishAr` поднимается
 * прежним `BAD_REQUEST` с текстом `label` ошибки — поведение UC/ER
 * не меняется, пока `Result` не дошёл до вызывающих (Ф3–4).
 */
export function throwIfRejected(
  res: Result<unknown, { readonly label: string }>,
): void {
  if (!res.ok) {
    throwError(errBadRequest('BAD_REQUEST', res.error.label, undefined));
  }
}

/**
 * Распаковка `Result<T, never>` (например, `WishAr.create`): ветка Err
 * недостижима по типу, значение возвращается как есть.
 */
export function unwrapInfallible<T>(res: Result<T, never>): T {
  if (!res.ok) return res.error;
  return res.value;
}
