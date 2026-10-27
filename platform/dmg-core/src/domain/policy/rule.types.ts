import type { Rule } from './rule';

/** Решение политики: разрешено или отказ с именем правила и текстом. */
export type Decision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly rule: string;
      readonly denyMessage: string;
    };

/** Тексты именованного правила: их видит граф и получает отказ. */
export type RuleTexts = {
  readonly name: string;
  readonly label: string;
  readonly denyMessage: string;
};

export type RuleSpec<U, C> = RuleTexts & {
  check(subject: U, ctx: C): boolean;
};

/** Сериализуемая форма правила — в графе как `policy` UC и `PolicyDef`. */
export type NormalizedRule =
  | (RuleTexts & { readonly dmg: 'rule'; readonly op: 'rule' })
  | (RuleTexts & {
      readonly dmg: 'rule';
      readonly op: 'anyOf';
      readonly rules: readonly NormalizedRule[];
    })
  | {
      readonly dmg: 'rule';
      readonly op: 'allOf';
      readonly rules: readonly NormalizedRule[];
    }
  | { readonly dmg: 'rule'; readonly op: 'allowAll' };

/** Любое правило — для композиции и ссылок `policy` в Def. */
export type AnyRule = Rule<never, never>;

/** Субъект, который умеет отвечать о своих ролях (например, `UserAr`). */
export type RoleHolder<R extends string> = { hasRole(role: R): boolean };

/** Субъект правила — кого принимает `evaluate`. */
export type RuleSubjectOf<R> = R extends Rule<infer U, infer _C> ? U : never;
/** Контекст правила — что прикладной слой загружает перед проверкой. */
export type RuleContextOf<R> = R extends Rule<infer _U, infer C> ? C : never;

// Рекурсия по кортежу, а не union: `unknown | Ctx` схлопнулся бы в `unknown`.
export type Subjects<R extends readonly unknown[]> = R extends readonly [
  infer H,
  ...infer T,
]
  ? RuleSubjectOf<H> & Subjects<T>
  : unknown;
export type Contexts<R extends readonly unknown[]> = R extends readonly [
  infer H,
  ...infer T,
]
  ? RuleContextOf<H> & Contexts<T>
  : unknown;
