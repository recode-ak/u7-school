import { type Caller, subjectOf } from '../../kernel/caller/caller';

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
  | (Named & { readonly op: 'rule'; readonly delegable: boolean })
  | (Named & { readonly op: 'anyOf'; readonly rules: readonly AnyRule[] })
  | { readonly op: 'allOf'; readonly rules: readonly AnyRule[] };

/** Правило над субъектом `U` в контексте `C` (DOM-05). */
export type Rule<U, C> = RuleNode & {
  readonly dmg: 'rule';
  // Свойство, а не метод: параметры строго контравариантны, поэтому контекст
  // композиции выводится пересечением контекстов правил.
  readonly evaluate: (caller: Caller<U>, ctx: C) => Decision;
};

/** Любое правило — для композиции и ссылок `policy` в Def. */
export type AnyRule = Rule<never, never>;

export type RuleSpec<U, C> = Named & {
  /** `false` — правило отказывает заместителю (`delegate`). По умолчанию `true`. */
  readonly delegable?: boolean;
  check(subject: U, ctx: C): boolean;
};

/**
 * Именованное правило. Проверяет субъекта (`subjectOf`): без субъекта
 * (guest, system) — отказ; `delegable: false` отказывает `delegate`.
 */
export function rule<U, C = unknown>(spec: RuleSpec<U, C>): Rule<U, C> {
  const delegable = spec.delegable ?? true;
  return {
    dmg: 'rule',
    op: 'rule',
    name: spec.name,
    label: spec.label,
    denyMessage: spec.denyMessage,
    delegable,
    evaluate(caller, ctx) {
      if (caller.kind === 'delegate' && !delegable) {
        return denied(spec.name, `Недоступно по делегированию: ${spec.label}.`);
      }
      const subject = subjectOf(caller);
      if (subject === undefined || !spec.check(subject, ctx)) {
        return denied(spec.name, spec.denyMessage);
      }
      return allowed;
    },
  };
}

/** Все правила; отказ — первое не прошедшее. */
export function allOf<U, C>(...rules: readonly Rule<U, C>[]): Rule<U, C> {
  return {
    dmg: 'rule',
    op: 'allOf',
    rules,
    evaluate(caller, ctx) {
      for (const r of rules) {
        const decision = r.evaluate(caller, ctx);
        if (!decision.allowed) return decision;
      }
      return allowed;
    },
  };
}

/** Хотя бы одно правило; отказ — со своим именем и текстом. */
export function anyOf<U, C>(
  meta: Named,
  ...rules: readonly Rule<U, C>[]
): Rule<U, C> {
  return {
    dmg: 'rule',
    op: 'anyOf',
    ...meta,
    rules,
    evaluate(caller, ctx) {
      const pass = rules.some((r) => r.evaluate(caller, ctx).allowed);
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
