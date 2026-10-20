import { AppException } from '@u7-scl/core/domain';
import { toLegacyError } from '@u7-scl/core/legacy-bridge';
import type { DomainError, Result } from 'dmg-core';

/**
 * Мост ошибки `WishErrors` → legacy-исключение: UC/ER остаются legacy-
 * классами до Ф8/Ф10, `Result` до вызывающих не доходит. Перевод — тот же
 * `toLegacyError`, что у `appApi.execute`: код → `name`, `kind` из Def,
 * `label` → `message`, `payload` как есть.
 */
export function throwWishError(error: DomainError): never {
  throw new AppException(toLegacyError(error));
}

/** `Err` перехода `WishAr` (`WISH_NOT_*`, `conflict`, TR-3) — исключением. */
export function throwIfRejected(res: Result<unknown, DomainError>): void {
  if (!res.ok) throwWishError(res.error);
}

/**
 * Распаковка `Result<T, never>` (например, `WishAr.create`): ветка Err
 * недостижима по типу, значение возвращается как есть.
 */
export function unwrapInfallible<T>(res: Result<T, never>): T {
  if (!res.ok) return res.error;
  return res.value;
}
