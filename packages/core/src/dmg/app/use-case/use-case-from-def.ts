import * as v from 'valibot';
import { serializeError } from '#shared/serialize-error';
import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '../../domain/contracts/define-use-case';
import type {
  Rule,
  RuleContextOf,
  RuleSubjectOf,
} from '../../domain/policy/policy';
import type { Caller } from '../../kernel/caller/caller';
import { CoreErrors } from '../../kernel/errors/core-errors';
import type { ErrorOf } from '../../kernel/errors/define-errors';
import { ok, type Result } from '../../kernel/result/result';
import type { ModuleDeps } from '../context';
import { contractUnitOfWork } from '../uow/contract-unit-of-work';
import type { UnitOfWork } from '../uow/unit-of-work';

/** Вход после схемы — то, что получают `load` и `execute`. */
export type ParsedInputOf<D extends AnyUseCaseDef> = v.InferOutput<D['input']>;

/** Выход до схемы — то, что возвращает `execute`. */
export type RawOutputOf<D extends AnyUseCaseDef> = v.InferInput<D['output']>;

/** Собственные ошибки UC — без базовых ядра: их подмешивает `handle`. */
export type OwnErrorOf<D extends AnyUseCaseDef> = ErrorOf<D['errors'][number]>;

/** Субъект Policy UC: `Caller` должен его нести. */
export type UseCaseSubjectOf<D extends AnyUseCaseDef> = RuleSubjectOf<
  D['policy']
>;

/** Контекст Policy UC: что `load` обязан загрузить. */
export type UseCaseContextOf<D extends AnyUseCaseDef> = RuleContextOf<
  D['policy']
>;

/** Метаданные вызова: причина, если UC вызван реакцией на событие. */
export type HandleMeta = { readonly causationId?: string };

/**
 * Что видно снаружи у реализации UC: Def и исполнение. Для карт модуля и
 * приложения — без приватных полей и строго контравариантной Policy,
 * поэтому реализацию любого `L` можно хранить рядом с другими.
 */
export type UseCaseHandler<D extends AnyUseCaseDef = AnyUseCaseDef> = {
  readonly def: D;
  handle(
    input: unknown,
    caller: Caller<UseCaseSubjectOf<D>>,
    meta?: HandleMeta,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * Реализация UC по Def (API-05). Наследник пишет только `load` (загрузить
 * то, что нужно Policy и операции) и `execute` (операция домена +
 * `uow.register`). Порядок, Policy, ошибки ядра, фиксация и публикация —
 * здесь (errors-result.md §3); свойства Def в наследнике не повторяются.
 *
 * `L` — загруженное: подтип контекста Policy (например, `{ task: TaskAr }`
 * для `{ task: ReadonlyAr<TaskAr> }`), поэтому Policy и операция видят
 * одни и те же агрегаты.
 */
export abstract class UseCaseFromDef<
  D extends AnyUseCaseDef,
  R extends ModuleDeps,
  L extends UseCaseContextOf<D>,
> {
  private readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;

  constructor(
    readonly def: D & {
      readonly policy: Rule<UseCaseSubjectOf<D>, UseCaseContextOf<D>>;
    },
    protected readonly resolve: R,
  ) {
    this.policy = def.policy;
  }

  protected abstract load(
    input: ParsedInputOf<D>,
    caller: Caller<UseCaseSubjectOf<D>>,
  ): Promise<Result<L, OwnErrorOf<D>>>;

  protected abstract execute(
    input: ParsedInputOf<D>,
    loaded: L,
    uow: UnitOfWork,
    caller: Caller<UseCaseSubjectOf<D>>,
  ): Promise<Result<RawOutputOf<D>, OwnErrorOf<D>>>;

  /**
   * callers → вход → load → Policy → execute → commit (с публикацией) →
   * выход. Непредвиденное исключение — `SERVER_INTERNAL` с записью в лог.
   */
  async handle(
    input: unknown,
    caller: Caller<UseCaseSubjectOf<D>>,
    meta: HandleMeta = {},
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    try {
      return await this.run(input, caller, meta);
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
    caller: Caller<UseCaseSubjectOf<D>>,
    meta: HandleMeta,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    if (!this.def.callers.includes(caller.kind)) {
      return CoreErrors.UNAUTHORIZED.err({ callerKind: caller.kind });
    }
    const parsed = v.safeParse(this.def.input, input);
    if (!parsed.success) {
      return CoreErrors.INPUT_VALIDATION.err({ issues: issues(parsed) });
    }
    const loaded = await this.load(parsed.output, caller);
    if (!loaded.ok) return loaded;
    // system допускается только через `callers`: его права — сам факт
    // объявления в Def; Policy проверяет субъекта, которого у system нет.
    if (caller.kind !== 'system') {
      const decision = this.policy.evaluate(caller, loaded.value);
      if (!decision.allowed) {
        const { rule, denyMessage } = decision;
        return CoreErrors.ACCESS_DENIED.err({ rule, denyMessage });
      }
    }
    const uow = contractUnitOfWork(this.resolve.app, {
      caller,
      causationId: meta.causationId,
      emits: this.def.emits ?? [],
    });
    const res = await this.execute(parsed.output, loaded.value, uow, caller);
    if (!res.ok) return res;
    await uow.commit();
    const output = v.safeParse(this.def.output, res.value);
    if (!output.success) {
      return CoreErrors.OUTPUT_VALIDATION.err({ issues: issues(output) });
    }
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
