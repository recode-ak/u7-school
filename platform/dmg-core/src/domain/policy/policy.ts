/** Решение политики: разрешено или отказ с именем правила и текстом. */
export type Decision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly rule: string;
      readonly denyMessage: string;
    };

export const allowed: Decision = { allowed: true };

export function denied(rule: string, denyMessage: string): Decision {
  return { allowed: false, rule, denyMessage };
}

type Named = {
  readonly name: string;
  readonly label: string;
  readonly denyMessage: string;
};

/** Структура правила — для нормализации и графа. */
export type RuleNode =
  | (Named & { readonly op: 'rule' })
  | (Named & { readonly op: 'anyOf'; readonly rules: readonly AnyRule[] })
  | { readonly op: 'allOf'; readonly rules: readonly AnyRule[] }
  | { readonly op: 'allowAll' };

/**
 * Правило над субъектом `U` в контексте `C` (DOM-05). Получает субъекта
 * (`caller.subject()`), а не вызывающего: вид вызывающего и делегирование
 * Policy не знает (D-43, Р2). `undefined` — субъекта нет (guest, system
 * без человека).
 */
export type Rule<U, C> = RuleNode & {
  readonly dmg: 'rule';
  // Свойство, а не метод: параметры строго контравариантны (метод бивариантен
  // и пропустил бы правило с чужим субъектом или контекстом).
  readonly evaluate: (subject: U | undefined, ctx: C) => Decision;
};

/** Любое правило — для композиции и ссылок `policy` в Def. */
export type AnyRule = Rule<never, never>;

export type RuleSpec<U, C> = Named & {
  check(subject: U, ctx: C): boolean;
};

/**
 * Именованное правило над субъектом. Без субъекта — отказ, `check` не
 * вызывается: системный вызов без человека разрешается только явно
 * (`allowAll` или переопределение `checkPolicy` в UC, D-43).
 */
export function rule<U, C = unknown>(spec: RuleSpec<U, C>): Rule<U, C> {
  return {
    dmg: 'rule',
    op: 'rule',
    name: spec.name,
    label: spec.label,
    denyMessage: spec.denyMessage,
    evaluate(subject, ctx) {
      if (subject === undefined || !spec.check(subject, ctx)) {
        return denied(spec.name, spec.denyMessage);
      }
      return allowed;
    },
  };
}

/**
 * Явное «доступно всем, кого пропустил `callers`», в том числе без субъекта —
 * для UC без ограничений и системного UC (`callers: ['system']`).
 * Политика в Def UC обязательна, чтобы её не забыли; отсутствие ограничений
 * тоже решение, и оно видно в контракте и графе.
 */
export const allowAll: Rule<unknown, unknown> = {
  dmg: 'rule',
  op: 'allowAll',
  evaluate: () => allowed,
};

/** Субъект правила — кого принимает `evaluate`. */
export type RuleSubjectOf<R> = R extends Rule<infer U, infer _C> ? U : never;
/** Контекст правила — что прикладной слой загружает перед проверкой. */
export type RuleContextOf<R> = R extends Rule<infer _U, infer C> ? C : never;

// Рекурсия по кортежу, а не union: `unknown | Ctx` схлопнулся бы в `unknown`.
type Subjects<R extends readonly unknown[]> = R extends readonly [
  infer H,
  ...infer T,
]
  ? RuleSubjectOf<H> & Subjects<T>
  : unknown;
type Contexts<R extends readonly unknown[]> = R extends readonly [
  infer H,
  ...infer T,
]
  ? RuleContextOf<H> & Contexts<T>
  : unknown;

/**
 * Композиция вычисляется всеми правилами на одном вызове, поэтому её субъект
 * и контекст — пересечения. Вывод TS по контравариантным кандидатам даёт
 * общий подтип, а не пересечение, — тип задают перегрузки.
 */
type Composite<R extends readonly unknown[]> = Rule<Subjects<R>, Contexts<R>>;

/** Все правила; отказ — первое не прошедшее. */
export function allOf<const R extends readonly AnyRule[]>(
  ...rules: R
): Composite<R>;
export function allOf<U, C>(...rules: readonly Rule<U, C>[]): Rule<U, C> {
  return {
    dmg: 'rule',
    op: 'allOf',
    rules,
    evaluate(subject, ctx) {
      for (const r of rules) {
        const decision = r.evaluate(subject, ctx);
        if (!decision.allowed) return decision;
      }
      return allowed;
    },
  };
}

/** Хотя бы одно правило; отказ — со своим именем и текстом. */
export function anyOf<const R extends readonly AnyRule[]>(
  meta: Named,
  ...rules: R
): Composite<R>;
export function anyOf<U, C>(
  meta: Named,
  ...rules: readonly Rule<U, C>[]
): Rule<U, C> {
  return {
    dmg: 'rule',
    op: 'anyOf',
    ...meta,
    rules,
    evaluate(subject, ctx) {
      const pass = rules.some((r) => r.evaluate(subject, ctx).allowed);
      return pass ? allowed : denied(meta.name, meta.denyMessage);
    },
  };
}

/** Субъект, который умеет отвечать о своих ролях (например, `UserAr`). */
export type RoleHolder<R extends string> = { hasRole(role: R): boolean };

/** У субъекта есть роль `role`. */
export function hasRole<R extends string>(
  role: R,
): Rule<RoleHolder<R>, unknown> {
  return rule({
    name: `hasRole:${role}`,
    label: `Роль ${role}`,
    denyMessage: `Нужна роль ${role}.`,
    check: (subject: RoleHolder<R>) => subject.hasRole(role),
  });
}
