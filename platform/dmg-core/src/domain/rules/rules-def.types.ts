import type { DefTexts } from '#core/kernel/def/def';
import type {
  AnyDomainRule,
  NormalizedDomainRule,
} from './domain-rule-def.types';
import type { RulesDef } from './rules-def';

export type RulesSpec = DefTexts & {
  /** Доменные правила агрегата: ключ — имя, значение — правило. */
  readonly rules: { readonly [key: string]: AnyDomainRule };
};

export type NormalizedRules = DefTexts & {
  readonly dmg: 'rules';
  readonly rules: { readonly [key: string]: NormalizedDomainRule };
};

export type AnyRulesDef = RulesDef<RulesSpec>;
