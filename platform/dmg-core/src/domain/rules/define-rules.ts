import type { AnyDomainRule } from './domain-rule';

export type RulesSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /** Доменные правила агрегата: ключ — имя, значение — правило. */
  readonly rules: { readonly [key: string]: AnyDomainRule };
};

export type RulesDef<S extends RulesSpec> = S & { readonly dmg: 'rules' };

export type AnyRulesDef = RulesDef<RulesSpec>;

/** Доменные правила агрегата (D-40), на которые ссылаются UC. */
export function defineRules<const S extends RulesSpec>(spec: S): RulesDef<S> {
  return { ...spec, dmg: 'rules' };
}
