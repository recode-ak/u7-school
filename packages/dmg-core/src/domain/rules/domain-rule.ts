import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/define-errors';
import type { Result } from '#core/kernel/result/result';

type Texts = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
};

/**
 * Доменное правило (D-40, DOM-16): «допустимо ли действие при текущих
 * состояниях агрегатов?». Без субъекта — ответ не зависит от вызывающего;
 * отказ — ошибка `E` своей группы с payload, а не `Decision`.
 */
export type DomainRule<C, E extends AnyErrorDef> = Texts & {
  readonly dmg: 'domainRule';
  readonly error: E;
  // Свойство, а не метод: параметр строго контравариантен (метод бивариантен
  // и пропустил бы правило с чужим контекстом), как у `Rule.evaluate`.
  readonly check: (ctx: C) => Result<void, ErrorOf<E>>;
};

/** Любое доменное правило — для ссылок `rules` в Def UC. */
export type AnyDomainRule = DomainRule<never, AnyErrorDef>;

/** Контекст правила — что прикладной слой загружает перед проверкой. */
export type DomainRuleContextOf<R> =
  R extends DomainRule<infer C, infer _E> ? C : never;

export type DomainRuleSpec<C, E extends AnyErrorDef> = Texts & {
  /** Ошибка отказа — `ErrorDef` группы агрегата (из `defineErrors`). */
  readonly error: E;
  /** Проверка над `ReadonlyAr`/значениями; вернуть можно только `error`. */
  readonly check: (ctx: C) => Result<void, ErrorOf<NoInfer<E>>>;
};

/** Именованное доменное правило: декларация + проверка. */
export function domainRule<C, const E extends AnyErrorDef>(
  spec: DomainRuleSpec<C, E>,
): DomainRule<C, E> {
  return {
    dmg: 'domainRule',
    name: spec.name,
    label: spec.label,
    description: spec.description,
    error: spec.error,
    check: spec.check,
  };
}
