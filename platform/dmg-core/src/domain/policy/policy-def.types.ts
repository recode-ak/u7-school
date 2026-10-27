import type { DefOf, DefTexts } from '#core/kernel/def/def';
import type { AnyRule, NormalizedRule } from './rule.types';

export type PolicySpec = DefTexts & {
  /** Вопросы «можно ли?» (DOM-10): ключ — имя, значение — правило. */
  readonly rules: { readonly [question: string]: AnyRule };
};

export type NormalizedPolicy = DefTexts & {
  readonly dmg: 'policy';
  readonly rules: { readonly [question: string]: NormalizedRule };
};

/** Любая политика — для индекса и графа. */
export type AnyPolicyDef = DefOf<'policy', NormalizedPolicy> & {
  readonly rules: PolicySpec['rules'];
};
