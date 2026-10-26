import * as v from 'valibot';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type {
  Rule,
  RuleContextOf,
  RuleSubjectOf,
} from '#core/domain/policy/policy';
import type {
  DomainRuleContextOf,
  DomainRuleDef,
} from '#core/domain/rules/domain-rule-def';
import type { Caller, Identified } from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { serializeError } from '#core/kernel/errors/serialize-error';
import { ok, type Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { ModuleDeps } from '../context';
import { OperationFromDef } from '../operation/operation-from-def';
import type { OperationRun } from '../oplog/operation-run';
import type { UnitOfWork } from '../uow/unit-of-work';

/** Вход после схемы — то, что получают `load` и `execute`. */
export type ParsedInputOf<D extends AnyUseCaseDef> = v.InferOutput<D['input']>;

/** Выход до схемы — то, что возвращает `execute`. */
export type RawOutputOf<D extends AnyUseCaseDef> = v.InferInput<D['output']>;

/** Субъект Policy UC: `Caller` должен его нести (и `uuid` — для лога). */
export type UseCaseSubjectOf<D extends AnyUseCaseDef> = RuleSubjectOf<
  D['policy']
> &
  Identified;

/** Контекст Policy UC: что `load` обязан загрузить. */
export type UseCaseContextOf<D extends AnyUseCaseDef> = RuleContextOf<
  D['policy']
>;

// Рекурсия по кортежу, а не union: `unknown | Ctx` схлопнулся бы в `unknown`.
type RuleContexts<R> = R extends readonly [infer H, ...infer T]
  ? DomainRuleContextOf<H> & RuleContexts<T>
  : unknown;

/** Контекст доменных правил UC — пересечение контекстов всех `rules`. */
export type UseCaseRulesContextOf<D extends AnyUseCaseDef> = RuleContexts<
  D['rules']
>;

/**
 * Доменное правило UC так, как его видит исполнение: контекст — загруженное,
 * ошибка — из `errors` UC (ERR-02). Правило с необъявленной ошибкой не
 * подходит конструктору; рантайм-проверку того же делает `checkDefs`.
 */
type UseCaseRule<D extends AnyUseCaseDef> = DomainRuleDef<
  UseCaseRulesContextOf<D>,
  D['errors'][number]
>;

/**
 * Что видно снаружи у реализации UC: Def и исполнение. Для хранения в модуле
 * и приложении — без приватных полей и строго контравариантной Policy,
 * поэтому реализации с разным `L` лежат рядом. `handle` — метод: хранилище
 * не должно делать `ApiApp` инвариантным по актору; строгую проверку
 * субъекта делает карта модуля (`ModuleMap`).
 */
export type UseCaseHandler<
  D extends AnyUseCaseDef = AnyUseCaseDef,
  U extends Identified = UseCaseSubjectOf<D>,
> = {
  readonly def: D;
  handle(
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * Реализация UC по Def (API-05). Наследник пишет только `load` (загрузить
 * то, что нужно Policy и операции) и `execute` (операция домена +
 * `uow.register`). Порядок, Policy, ошибки ядра, фиксация и публикация —
 * здесь (errors-result.md §3); свойства Def в наследнике не повторяются.
 * Шаги — `protected`: наследник может их переопределить (например,
 * ослабить `checkPolicy` для системного вызова, D-43) — под свою
 * ответственность.
 *
 * `L` — загруженное: подтип контекста Policy и контекстов всех доменных
 * правил (например, `{ task: TaskAr }` для `{ task: ReadonlyAr<TaskAr> }`),
 * поэтому Policy, правила и операция видят одни и те же агрегаты.
 *
 * `U` — субъект вызывающего, который знает реализация: тип пользователя
 * замыкает приложение (D-04). Он не уже субъекта Policy; при `allowAll`
 * Policy о субъекте молчит, а реализации нужен, например, его `uuid`.
 */
export abstract class UseCaseFromDef<
  D extends AnyUseCaseDef,
  R extends ModuleDeps,
  L extends UseCaseContextOf<D> & UseCaseRulesContextOf<D>,
  U extends UseCaseSubjectOf<D> = UseCaseSubjectOf<D>,
> extends OperationFromDef<D, R> {
  private readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;
  private readonly rules: readonly UseCaseRule<D>[];

  /**
   * `module` — Def модуля-владельца: его передаёт `ModuleFromDef` (D-43),
   * наследник проксирует в `super`. UC не из его `useCases` — исключение
   * (ошибка сборки).
   */
  constructor(
    def: D & {
      readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;
      readonly rules?: readonly UseCaseRule<D>[];
    },
    resolve: R,
    module: AnyModuleDef,
  ) {
    super(def, resolve, module, 'useCase');
    this.policy = def.policy;
    this.rules = def.rules ?? [];
  }

  /**
   * `trace` — для вызова UC другого модуля (`this.call`). Ошибки —
   * объявленные в `errors` и базовые ядра: отказ UC другого модуля
   * (`ACCESS_DENIED`, `UNAUTHORIZED`, …) приходит как есть, и UC
   * возвращает его дальше (D-43).
   */
  protected abstract load(
    input: ParsedInputOf<D>,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<L, UseCaseErrorOf<D>>>;

  protected abstract execute(
    input: ParsedInputOf<D>,
    loaded: L,
    uow: UnitOfWork,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<RawOutputOf<D>, UseCaseErrorOf<D>>>;

  /**
   * Субъект вызывающего — для UC, которому он нужен (владелец новой
   * записи, «мои» записи). Без субъекта — `throw`: `callers` такого UC
   * не должен допускать guest/system, это баг Def.
   */
  protected subject(caller: Caller<U>): U {
    const subject = caller.subject();
    if (subject === undefined) {
      throw new Error(
        `UC ${this.def.name}: у вызывающего ${caller.kind} нет субъекта — проверьте callers`,
      );
    }
    return subject;
  }

  /**
   * Шаги: `checkCaller` → `parseInput` → `load` → `checkPolicy` →
   * `checkRules` → `execute` → `parseOutput` → фиксация (с публикацией) →
   * запись в лог операций (любой исход). Непредвиденное исключение —
   * `SERVER_INTERNAL` с записью в лог.
   */
  handle(
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.journal({ input, caller, trace }, async (run) => {
      try {
        return await this.run(input, caller, trace, run);
      } catch (error) {
        this.resolve.app.logger.error(
          this.def.name,
          'Непредвиденный сбой UC',
          serializeError(error),
        );
        return CoreErrors.SERVER_INTERNAL.err();
      }
    });
  }

  /** Вид вызывающего — из `callers` Def; иначе `UNAUTHORIZED`. */
  protected checkCaller(caller: Caller<U>): Result<void, UseCaseErrorOf<D>> {
    if (!this.def.callers.includes(caller.kind)) {
      return CoreErrors.UNAUTHORIZED.err({ callerKind: caller.kind });
    }
    return ok();
  }

  /** Вход по схеме Def; иначе `INPUT_VALIDATION` с путями полей. */
  protected parseInput(
    input: unknown,
  ): Result<ParsedInputOf<D>, UseCaseErrorOf<D>> {
    const parsed = v.safeParse(this.def.input, input);
    if (!parsed.success) {
      return CoreErrors.INPUT_VALIDATION.err({ issues: issues(parsed) });
    }
    return ok(parsed.output);
  }

  /**
   * Policy Def по субъекту вызывающего — вызывается всегда (D-43, Р2):
   * правило без субъекта (guest, system без человека) — отказ
   * `ACCESS_DENIED`. Системный вызов без человека разрешается явно:
   * `allowAll` в Def системного UC или переопределение этого шага в
   * наследнике — его право и ответственность.
   */
  protected checkPolicy(
    loaded: L,
    caller: Caller<U>,
  ): Result<void, UseCaseErrorOf<D>> {
    const decision = this.policy.evaluate(caller.subject(), loaded);
    if (!decision.allowed) {
      const { rule, denyMessage } = decision;
      return CoreErrors.ACCESS_DENIED.err({ rule, denyMessage });
    }
    return ok();
  }

  /**
   * Доменные правила Def: субъекта не знают — проверяются для любого
   * вызывающего. Отказ — до UoW: следов не остаётся.
   */
  protected checkRules(loaded: L): Result<void, UseCaseErrorOf<D>> {
    for (const r of this.rules) {
      const checked = r.check(loaded);
      if (!checked.ok) return checked;
    }
    return ok();
  }

  /**
   * Выход по схеме Def — до фиксации: невалидный ответ — баг реализации, и
   * тогда операция не оставляет следов (клиент может безопасно повторить).
   */
  protected parseOutput(
    raw: RawOutputOf<D>,
  ): Result<OutputOf<D>, UseCaseErrorOf<D>> {
    const output = v.safeParse(this.def.output, raw);
    if (!output.success) {
      return CoreErrors.OUTPUT_VALIDATION.err({ issues: issues(output) });
    }
    return ok(output.output);
  }

  private async run(
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
    run: OperationRun,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const allowed = this.checkCaller(caller);
    if (!allowed.ok) return allowed;
    const parsed = this.parseInput(input);
    if (!parsed.ok) return parsed;
    const loaded = await this.load(parsed.value, caller, trace);
    if (!loaded.ok) return loaded;
    const permitted = this.checkPolicy(loaded.value, caller);
    if (!permitted.ok) return permitted;
    const checked = this.checkRules(loaded.value);
    if (!checked.ok) return checked;
    const uow = run.track(this.createUow(trace));
    const res = await this.execute(
      parsed.value,
      loaded.value,
      uow,
      caller,
      trace,
    );
    if (!res.ok) return res;
    const output = this.parseOutput(res.value);
    if (!output.ok) return output;
    const committed = await uow.commit();
    if (!committed.ok) return committed;
    return output;
  }
}

type Issue = { readonly path: string; readonly message: string };

function issues(failure: {
  readonly issues: readonly v.BaseIssue<unknown>[];
}): Issue[] {
  return failure.issues.map((issue) => ({
    path: v.getDotPath(issue) ?? '',
    message: issue.message,
  }));
}
