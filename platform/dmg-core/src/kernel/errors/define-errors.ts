import { ErrorDef } from './error-def';
import type { ErrorGroup, ErrorSpec } from './error-def.types';

export { ErrorDef } from './error-def';
export type {
  AnyErrorDef,
  ErrorGroup,
  ErrorOf,
  ErrorSpec,
} from './error-def.types';

/**
 * Группа ошибок агрегата — обёртка над `ErrorDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineErrors<
  const P extends string,
  const M extends Record<string, ErrorSpec>,
>(prefix: P, specs: M): ErrorGroup<P, M> {
  return ErrorDef.define(prefix, specs);
}

/** Сборка группы с пустым префиксом — то же, что `ErrorDef.define`. */
export function buildErrors<
  const P extends string,
  const M extends Record<string, ErrorSpec>,
>(prefix: P, specs: M): ErrorGroup<P, M> {
  return ErrorDef.define(prefix, specs);
}
