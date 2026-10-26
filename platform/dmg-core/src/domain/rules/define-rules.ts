import { RulesDef } from './rules-def';
import type { RulesSpec } from './rules-def.types';

export { RulesDef } from './rules-def';
export type { AnyRulesDef, RulesSpec } from './rules-def.types';

/**
 * Доменные правила агрегата — обёртка над `RulesDef.define` на время
 * перевода потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineRules<const S extends RulesSpec>(spec: S): RulesDef<S> {
  return RulesDef.define(spec);
}
