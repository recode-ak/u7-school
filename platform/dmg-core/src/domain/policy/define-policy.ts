import { PolicyDef } from './policy-def';
import type { PolicySpec } from './policy-def.types';

export { PolicyDef } from './policy-def';
export type { AnyPolicyDef, PolicySpec } from './policy-def.types';

/**
 * Политика агрегата — обёртка над `PolicyDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function definePolicy<const S extends PolicySpec>(
  spec: S,
): PolicyDef<S> {
  return PolicyDef.define(spec);
}
