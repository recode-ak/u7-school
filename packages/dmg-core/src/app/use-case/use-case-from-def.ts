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
  DomainRule,
  DomainRuleContextOf,
} from '#core/domain/rules/domain-rule';
import type { CallContext } from '#core/kernel/caller/call-context';
import {
  type Caller,
  type Identified,
  type OperationRef,
  SystemCaller,
} from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { serializeError } from '#core/kernel/errors/serialize-error';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { ModuleDeps } from '../context';
import type { Trace } from '../trace';
import { contractUnitOfWork } from '../uow/contract-unit-of-work';
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
type UseCaseRule<D extends AnyUseCaseDef> = DomainRule<
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
> {
  private readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;
  private readonly rules: readonly UseCaseRule<D>[];
  /** Эта операция — `from` вызывающего, когда она зовёт другие модули. */
  readonly ref: OperationRef;

  /**
   * `module` — Def модуля-владельца: даёт `ref` (D-43). UC не из его
   * `useCases` — исключение (ошибка сборки).
   */
  constructor(
    readonly def: D & {
      readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;
      readonly rules?: readonly UseCaseRule<D>[];
    },
    protected readonly resolve: R,
    module: AnyModuleDef,
  ) {
    if (!module.useCases.includes(def)) {
      throw new Error(`UC ${def.name} не входит в модуль ${module.name}`);
    }
    this.policy = def.policy;
    this.rules = def.rules ?? [];
    this.ref = { kind: 'useCase', module: module.name, name: def.name };
  }

  /**
   * `trace` — для вызова фасада другого модуля (`callContext`). Ошибки —
   * объявленные в `errors` и базовые ядра: отказ UC другого модуля
   * (`ACCESS_DENIED`, `UNAUTHORIZED`, …) фасад отдаёт как есть, и UC
   * возвращает его дальше (D-42).
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
   * Контекст вызова фасада другого модуля (D-42): вызывающий —
   * `SystemCaller` этого UC с исходным человеком, след — дальше по
   * цепочке. Фасад проверит, что вызываемый UC есть в `calls` этого UC.
   */
  protected callContext(caller: Caller<U>, trace: Trace): CallContext {
    return {
      caller: new SystemCaller(this.ref, caller.person()),
      calls: this.def.calls ?? [],
      trace,
    };
  }

  /** Текущий момент по часам приложения — передаётся в операции домена. */
  protected now(): Timestamp {
    return this.resolve.app.clock();
  }

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
   * callers → вход → load → Policy → правила →
   * execute → выход → commit (с публикацией). Непредвиденное исключение —
   * `SERVER_INTERNAL` с записью в лог.
   */
  async handle(
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    try {
      return await this.run(input, caller, trace);
    } catch (error) {
      this.resolve.app.logger.error(
        this.def.name,
        'Непредвиденный сбой UC',
        serializeError(error),
      );
      return CoreErrors.SERVER_INTERNAL.err();
    }
  }

  private async run(
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    if (!this.def.callers.includes(caller.kind)) {
      return CoreErrors.UNAUTHORIZED.err({ callerKind: caller.kind });
    }
    const parsed = v.safeParse(this.def.input, input);
    if (!parsed.success) {
      return CoreErrors.INPUT_VALIDATION.err({ issues: issues(parsed) });
    }
    const loaded = await this.load(parsed.output, caller, trace);
    if (!loaded.ok) return loaded;
    // До Р2 (D-43): system без человека (ER, Job) допускается только через
    // `callers` — его права — сам факт объявления в Def. С человеком
    // (вызов через фасад от UC) — Policy по субъекту человека.
    if (caller.kind !== 'system' || caller.person() !== undefined) {
      const decision = this.policy.evaluate(caller, loaded.value);
      if (!decision.allowed) {
        const { rule, denyMessage } = decision;
        return CoreErrors.ACCESS_DENIED.err({ rule, denyMessage });
      }
    }
    // Доменные правила субъекта не знают — проверяются для любого
    // вызывающего, в том числе system. Отказ — до UoW: следов не остаётся.
    for (const r of this.rules) {
      const checked = r.check(loaded.value);
      if (!checked.ok) return checked;
    }
    const uow = contractUnitOfWork(this.resolve.app, {
      source: this.def.name,
      caller,
      trace,
      emits: this.def.emits ?? [],
    });
    const res = await this.execute(
      parsed.output,
      loaded.value,
      uow,
      caller,
      trace,
    );
    if (!res.ok) return res;
    // Выход сверяется до фиксации: невалидный ответ — баг реализации, и
    // тогда операция не оставляет следов (клиент может безопасно повторить).
    const output = v.safeParse(this.def.output, res.value);
    if (!output.success) {
      return CoreErrors.OUTPUT_VALIDATION.err({ issues: issues(output) });
    }
    const committed = await uow.commit();
    if (!committed.ok) return committed;
    return ok(output.output);
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
