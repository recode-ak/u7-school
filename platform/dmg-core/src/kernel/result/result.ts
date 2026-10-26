/** Успешный исход операции. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** Штатный отказ операции — значение, а не исключение (D-13). */
export type Err<E> = { readonly ok: false; readonly error: E };

/** Исход операции: сужается по `res.ok`. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Успех со значением; без аргумента — `Ok<void>`. */
export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

/** Штатный отказ. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
