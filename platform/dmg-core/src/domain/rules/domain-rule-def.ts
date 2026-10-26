import { Def } from '#core/kernel/def/def';
import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/error-def';
import type { Result } from '#core/kernel/result/result';
import type {
  DomainRuleSpec,
  NormalizedDomainRule,
} from './domain-rule-def.types';

export type {
  AnyDomainRule,
  DomainRuleContextOf,
  DomainRuleSpec,
  NormalizedDomainRule,
} from './domain-rule-def.types';

/**
 * Доменное правило (D-40, DOM-16): «допустимо ли действие при текущих
 * состояниях агрегатов?». Без субъекта — ответ не зависит от вызывающего;
 * отказ — ошибка `E` своей группы с payload, а не `Decision`.
 */
export class DomainRuleDef<
  C = never,
  const E extends AnyErrorDef = AnyErrorDef,
> extends Def {
  readonly dmg = 'domainRule';
  readonly error: E;
  // Свойство, а не метод: параметр строго контравариантен (метод бивариантен
  // и пропустил бы правило с чужим контекстом), как у `Rule.evaluate`.
  readonly check: (ctx: C) => Result<void, ErrorOf<E>>;

  constructor(spec: DomainRuleSpec<C, E>) {
    super(spec);
    this.error = spec.error;
    this.check = spec.check;
  }

  static define<C, const E extends AnyErrorDef>(
    spec: DomainRuleSpec<C, E>,
  ): DomainRuleDef<C, E> {
    return new DomainRuleDef(spec);
  }

  normalize(): NormalizedDomainRule {
    return { dmg: this.dmg, ...this.texts(), error: this.error.code };
  }
}
