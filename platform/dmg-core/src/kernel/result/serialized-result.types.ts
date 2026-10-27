import type { ErrorKind } from '../errors/error';
import type { Err, Ok } from './result';

/**
 * Ошибка в ответе транспорта (transport.md §1): без `label` и
 * `description` — их восстанавливает клиент по Def ошибки.
 */
export type SerializedError = {
  readonly code: string;
  readonly kind: ErrorKind;
  readonly payload?: unknown;
};

/** `Result` в форме транспорта: простые данные, переживают JSON. */
export type SerializedResult<T = unknown> = Ok<T> | Err<SerializedError>;
