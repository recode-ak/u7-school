import type { AnyRule } from './policy';

export type PolicySpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /** Вопросы «можно ли?» (DOM-10): ключ — имя, значение — правило. */
  readonly rules: { readonly [question: string]: AnyRule };
};

export type PolicyDef<P extends PolicySpec> = P & { readonly dmg: 'policy' };

export type AnyPolicyDef = PolicyDef<PolicySpec>;

/** Политика агрегата: именованные правила, на которые ссылаются UC. */
export function definePolicy<const P extends PolicySpec>(
  spec: P,
): PolicyDef<P> {
  return { ...spec, dmg: 'policy' };
}
