import type { DefOf, DefTexts } from '#core/kernel/def/def';
import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/error-def';
import type { Result } from '#core/kernel/result/result';
import type { DomainRuleDef } from './domain-rule-def';

export type DomainRuleSpec<C, E extends AnyErrorDef> = DefTexts & {
  /** Ошибка отказа — `ErrorDef` группы агрегата. */
  readonly error: E;
  /** Проверка над `ReadonlyAr`/значениями; вернуть можно только `error`. */
  readonly check: (ctx: C) => Result<void, ErrorOf<NoInfer<E>>>;
};

/** Доменное правило (D-40): тексты и код ошибки отказа. */
export type NormalizedDomainRule = DefTexts & {
  readonly dmg: 'domainRule';
  readonly error: string;
};

/** Любое доменное правило — для ссылок `rules` в Def UC. */
export type AnyDomainRule = DefOf<'domainRule', NormalizedDomainRule> & {
  readonly error: AnyErrorDef;
  readonly check: (ctx: never) => Result<void, ErrorOf<AnyErrorDef>>;
};

/** Контекст правила — что прикладной слой загружает перед проверкой. */
export type DomainRuleContextOf<R> =
  R extends DomainRuleDef<infer C, infer _E> ? C : never;
