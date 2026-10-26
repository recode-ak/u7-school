import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import { DomainRuleDef } from './domain-rule-def';
import type { DomainRuleSpec } from './domain-rule-def.types';

export { DomainRuleDef } from './domain-rule-def';
export type {
  AnyDomainRule,
  DomainRuleContextOf,
  DomainRuleSpec,
} from './domain-rule-def.types';

/** Доменное правило — прежнее имя типа `DomainRuleDef` (Фаза 7 удаляет). */
export type DomainRule<C, E extends AnyErrorDef> = DomainRuleDef<C, E>;

/**
 * Именованное доменное правило — обёртка над `DomainRuleDef.define` на время
 * перевода потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function domainRule<C, const E extends AnyErrorDef>(
  spec: DomainRuleSpec<C, E>,
): DomainRuleDef<C, E> {
  return DomainRuleDef.define(spec);
}
