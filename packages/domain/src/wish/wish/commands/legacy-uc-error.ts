// DEBT-21
import type { ConflictError, NotFoundError } from '@u7-scl/core/domain';
import type { ErrorOf } from 'dmg-core';
import type { WishErrors } from '../wish.errors';

type WishErrorKey = keyof typeof WishErrors;

/**
 * Ошибка UC в форме legacy `AppError` по Def `WishErrors` — для `errors`
 * legacy-мет команд, пока UC не стали `defineUseCase` (Ф8–9). Рантайм-форму
 * даёт тот же перевод (`toLegacyError`): код → `name`, `not_found` →
 * `not-found`, `label` → `message`.
 */
export type LegacyWishUcError<K extends WishErrorKey> =
  ErrorOf<(typeof WishErrors)[K]> extends infer E extends {
    code: string;
    kind: string;
    payload: unknown;
  }
    ? E['kind'] extends 'not_found'
      ? NotFoundError<E['code'], E['payload']>
      : E['kind'] extends 'conflict'
        ? ConflictError<E['code'], E['payload']>
        : never
    : never;
