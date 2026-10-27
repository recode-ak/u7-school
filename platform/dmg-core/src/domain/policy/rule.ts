import type {
  AnyRule,
  Contexts,
  Decision,
  NormalizedRule,
  RoleHolder,
  RuleSpec,
  RuleTexts,
  Subjects,
} from './rule.types';

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

export const allowed: Decision = { allowed: true };

export function denied(rule: string, denyMessage: string): Decision {
  return { allowed: false, rule, denyMessage };
}

/**
 * Правило над субъектом `U` в контексте `C` (DOM-05). Получает субъекта
 * (`caller.subject()`), а не вызывающего: вид вызывающего и делегирование
 * Policy не знает (D-43, Р2). `undefined` — субъекта нет (guest, system
 * без человека). Вид правила — наследник; композиция — `allOf`/`anyOf`.
 * Без `private`/`#`: типизация структурная (`AnyRule`).
 */
export abstract class Rule<U, C> {
  readonly dmg = 'rule';
  abstract readonly op: NormalizedRule['op'];
  // Свойство, а не метод: параметры строго контравариантны (метод бивариантен
  // и пропустил бы правило с чужим субъектом или контекстом).
  abstract readonly evaluate: (subject: U | undefined, ctx: C) => Decision;

  /** Сериализуемая форма для графа: тексты и вложенные правила. */
  abstract normalize(): NormalizedRule;

  /** Именованное правило над субъектом. */
  static of<U, C = unknown>(spec: RuleSpec<U, C>): NamedRule<U, C> {
    return new NamedRule(spec);
  }

  /**
   * Все правила; отказ — первое не прошедшее. Композиция вычисляется всеми
   * правилами на одном вызове, поэтому её субъект и контекст — пересечения.
   * Вывод TS по контравариантным кандидатам даёт общий подтип, а не
   * пересечение, — тип задают перегрузки.
   */
  static allOf<const R extends readonly AnyRule[]>(
    ...rules: R
  ): AllOfRule<Subjects<R>, Contexts<R>>;
  static allOf<U, C>(...rules: readonly Rule<U, C>[]): AllOfRule<U, C> {
    return new AllOfRule(rules);
  }

  /** Хотя бы одно правило; отказ — со своим именем и текстом. */
  static anyOf<const R extends readonly AnyRule[]>(
    texts: RuleTexts,
    ...rules: R
  ): AnyOfRule<Subjects<R>, Contexts<R>>;
  static anyOf<U, C>(
    texts: RuleTexts,
    ...rules: readonly Rule<U, C>[]
  ): AnyOfRule<U, C> {
    return new AnyOfRule(texts, rules);
  }

  /** У субъекта есть роль `role`. */
  static hasRole<R extends string>(role: R): NamedRule<RoleHolder<R>, unknown> {
    return Rule.of({
      name: `hasRole:${role}`,
      label: `Роль ${role}`,
      denyMessage: `Нужна роль ${role}.`,
      check: (subject: RoleHolder<R>) => subject.hasRole(role),
    });
  }
}

/**
 * Именованное правило. Без субъекта — отказ, `check` не вызывается:
 * системный вызов без человека разрешается только явно (`allowAll` или
 * переопределение `checkPolicy` в UC, D-43).
 */
export class NamedRule<U, C> extends Rule<U, C> {
  readonly op = 'rule';
  readonly name: string;
  readonly label: string;
  readonly denyMessage: string;
  readonly check: (subject: U, ctx: C) => boolean;

  constructor(spec: RuleSpec<U, C>) {
    super();
    this.name = spec.name;
    this.label = spec.label;
    this.denyMessage = spec.denyMessage;
    this.check = (subject, ctx) => spec.check(subject, ctx);
  }

  readonly evaluate = (subject: U | undefined, ctx: C): Decision =>
    subject === undefined || !this.check(subject, ctx)
      ? denied(this.name, this.denyMessage)
      : allowed;

  normalize(): NormalizedRule {
    return { dmg: this.dmg, op: this.op, ...this.texts() };
  }

  texts(): RuleTexts {
    return {
      name: this.name,
      label: this.label,
      denyMessage: this.denyMessage,
    };
  }
}

/** Все правила; отказ — первое не прошедшее. */
export class AllOfRule<U, C> extends Rule<U, C> {
  readonly op = 'allOf';
  readonly rules: readonly Rule<U, C>[];

  constructor(rules: readonly Rule<U, C>[]) {
    super();
    this.rules = rules;
  }

  readonly evaluate = (subject: U | undefined, ctx: C): Decision => {
    for (const r of this.rules) {
      const decision = r.evaluate(subject, ctx);
      if (!decision.allowed) return decision;
    }
    return allowed;
  };

  normalize(): NormalizedRule {
    return {
      dmg: this.dmg,
      op: this.op,
      rules: this.rules.map((r) => r.normalize()),
    };
  }
}

/** Хотя бы одно правило; отказ — со своим именем и текстом. */
export class AnyOfRule<U, C> extends Rule<U, C> {
  readonly op = 'anyOf';
  readonly name: string;
  readonly label: string;
  readonly denyMessage: string;
  readonly rules: readonly Rule<U, C>[];

  constructor(texts: RuleTexts, rules: readonly Rule<U, C>[]) {
    super();
    this.name = texts.name;
    this.label = texts.label;
    this.denyMessage = texts.denyMessage;
    this.rules = rules;
  }

  readonly evaluate = (subject: U | undefined, ctx: C): Decision =>
    this.rules.some((r) => r.evaluate(subject, ctx).allowed)
      ? allowed
      : denied(this.name, this.denyMessage);

  normalize(): NormalizedRule {
    return {
      dmg: this.dmg,
      op: this.op,
      name: this.name,
      label: this.label,
      denyMessage: this.denyMessage,
      rules: this.rules.map((r) => r.normalize()),
    };
  }
}

/**
 * Явное «доступно всем, кого пропустил `callers`», в том числе без субъекта —
 * для UC без ограничений и системного UC (`callers: ['system']`).
 * Политика в Def UC обязательна, чтобы её не забыли; отсутствие ограничений
 * тоже решение, и оно видно в контракте и графе.
 */
export class AllowAll extends Rule<unknown, unknown> {
  readonly op = 'allowAll';
  readonly evaluate: (subject: unknown, ctx: unknown) => Decision = () =>
    allowed;

  normalize(): NormalizedRule {
    return { dmg: this.dmg, op: this.op };
  }
}

/** Единственный экземпляр `AllowAll`. */
export const allowAll: AllowAll = new AllowAll();
