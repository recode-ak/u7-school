import { errBadRequest, throwError } from '@u7-scl/core/domain';

/** Исход перехода агрегата: структурно совпадает с `Result` из `dmg-core`. */
type TransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly label: string } };

/**
 * Мост `Result` → legacy-исключение: отказ перехода `WishAr` поднимается
 * прежним `BAD_REQUEST` с текстом `label` ошибки — поведение UC/ER
 * не меняется, пока `Result` не дошёл до вызывающих (Ф3–4).
 */
export function throwIfRejected(res: TransitionResult): void {
  if (!res.ok) {
    throwError(errBadRequest('BAD_REQUEST', res.error.label, undefined));
  }
}
