import { type AllOfRule, type AnyOfRule, type NamedRule, Rule } from './rule';
import type {
  AnyRule,
  Contexts,
  RoleHolder,
  RuleSpec,
  RuleTexts,
  Subjects,
} from './rule.types';

export {
  AllOfRule,
  AllowAll,
  AnyOfRule,
  allowAll,
  allowed,
  denied,
  NamedRule,
  Rule,
} from './rule';
export type {
  AnyRule,
  Decision,
  NormalizedRule,
  RoleHolder,
  RuleContextOf,
  RuleSpec,
  RuleSubjectOf,
  RuleTexts,
} from './rule.types';

// Обёртки над фабриками `Rule` на время перевода потребителей
// (трек dmg-core-oop, Фаза 7 удаляет).

/** Именованное правило — `Rule.of`. */
export function rule<U, C = unknown>(spec: RuleSpec<U, C>): NamedRule<U, C> {
  return Rule.of(spec);
}

/** Все правила — `Rule.allOf`. */
export function allOf<const R extends readonly AnyRule[]>(
  ...rules: R
): AllOfRule<Subjects<R>, Contexts<R>> {
  return Rule.allOf(...rules);
}

/** Хотя бы одно правило — `Rule.anyOf`. */
export function anyOf<const R extends readonly AnyRule[]>(
  texts: RuleTexts,
  ...rules: R
): AnyOfRule<Subjects<R>, Contexts<R>> {
  return Rule.anyOf(texts, ...rules);
}

/** У субъекта есть роль — `Rule.hasRole`. */
export function hasRole<R extends string>(
  role: R,
): NamedRule<RoleHolder<R>, unknown> {
  return Rule.hasRole(role);
}
