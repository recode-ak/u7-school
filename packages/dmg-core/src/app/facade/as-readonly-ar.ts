import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { ok, type Result } from '#core/kernel/result/result';

/**
 * Класс агрегата с `static restore(snapshot)` — как его объявляет Ar.
 * Свойство, а не метод: параметр строго контравариантен, и state другого
 * агрегата не пройдёт.
 */
export type Restorable<S, A> = { readonly restore: (snapshot: S) => A };

/**
 * Выход UC, который является state агрегата (один или массив), — в
 * `ReadonlyAr` для потребителя фасада (D-42, API-04): клиент получает
 * готовый агрегат, а не entity (DOM-01). Восстановление — `restore` класса
 * Ar (он же проверяет state схемой Def); ошибка UC — как есть.
 */
export function asReadonlyAr<S, A, E>(
  ar: Restorable<S, A>,
  res: Result<readonly S[], E>,
): Result<ReadonlyAr<A>[], E>;
export function asReadonlyAr<S, A, E>(
  ar: Restorable<S, A>,
  res: Result<S, E>,
): Result<ReadonlyAr<A>, E>;
export function asReadonlyAr<S, A, E>(
  ar: Restorable<S, A>,
  res: Result<S | readonly S[], E>,
): Result<ReadonlyAr<A> | ReadonlyAr<A>[], E> {
  if (!res.ok) return res;
  const { value } = res;
  return ok(
    isList(value) ? value.map((s) => ar.restore(s)) : ar.restore(value),
  );
}

function isList<S>(value: S | readonly S[]): value is readonly S[] {
  return Array.isArray(value);
}
