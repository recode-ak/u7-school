import { UseCaseDef } from './use-case-def';
import type { SystemCalls, UseCaseSpec } from './use-case-def.types';

export { UseCaseDef } from './use-case-def';
export type {
  AnyUseCaseDef,
  DeclaredCalls,
  InputOf,
  OutputOf,
  SystemCallableUc,
  SystemCalls,
  UseCaseErrorOf,
  UseCaseSpec,
} from './use-case-def.types';

/**
 * Контракт UC — обёртка над `UseCaseDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineUseCase<const S extends UseCaseSpec>(
  spec: S & SystemCalls<S>,
): UseCaseDef<S> {
  return UseCaseDef.define<S>(spec);
}
