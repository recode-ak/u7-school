import type { DefSchemas } from '#core/kernel/def/def';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { type AnyErrorDef, ErrorDef } from '#core/kernel/errors/error-def';
import { err, type Result } from '#core/kernel/result/result';
import type { SerializedResult } from '#core/kernel/result/serialized-result.types';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { Command, CommandMeta } from './command';
import { OperationDef } from './operation-def';
import type { Declared } from './operation-def.types';
import type {
  InputOf,
  NormalizedUseCase,
  OutputOf,
  SystemCalls,
  UseCaseErrorOf,
  UseCaseSpec,
} from './use-case-def.types';

export type {
  AnyUseCaseDef,
  InputOf,
  NormalizedUseCase,
  OutputOf,
  SystemCallableUc,
  SystemCalls,
  UseCaseErrorOf,
  UseCaseSpec,
} from './use-case-def.types';

/**
 * Контракт UC: кто вызывает, право и доменные правила, вход и выход,
 * ошибки и события. Необъявленные `rules`, `calls`, `emits` — пустые
 * кортежи из конструктора.
 */
export class UseCaseDef<
  const S extends UseCaseSpec = UseCaseSpec,
> extends OperationDef<S['name']> {
  declare readonly calls: Declared<S, 'calls'>;
  readonly dmg = 'useCase';
  readonly abbr = 'UC';
  readonly fileKind = 'uc';
  readonly type: S['type'];
  readonly aggregate: S['aggregate'];
  readonly callers: S['callers'];
  readonly policy: S['policy'];
  readonly rules: Declared<S, 'rules'>;
  readonly input: S['input'];
  readonly output: S['output'];
  readonly errors: S['errors'];
  readonly emits: Declared<S, 'emits'>;

  constructor(spec: S) {
    super(spec);
    this.type = spec.type;
    this.aggregate = spec.aggregate;
    this.callers = spec.callers;
    this.policy = spec.policy;
    this.rules = (spec.rules ?? []) as Declared<S, 'rules'>;
    this.input = spec.input;
    this.output = spec.output;
    this.errors = spec.errors;
    this.emits = (spec.emits ?? []) as Declared<S, 'emits'>;
  }

  static define<const S extends UseCaseSpec>(
    spec: S & SystemCalls<S>,
  ): UseCaseDef<S> {
    return new UseCaseDef<S>(spec);
  }

  /**
   * Команда для исполнения (D-49): простые данные, адрес модуля добавляет
   * транспорт. Вход не валидируется — это делает UC при исполнении.
   */
  command(
    input: InputOf<UseCaseDef<S>>,
    meta?: CommandMeta,
  ): Command<UseCaseDef<S>> {
    return meta === undefined
      ? { uc: this.name, input }
      : { uc: this.name, input, meta };
  }

  /** Ответ UC в форме транспорта (transport.md §1). */
  serializeResult(
    result: Result<OutputOf<UseCaseDef<S>>, UseCaseErrorOf<UseCaseDef<S>>>,
  ): SerializedResult<OutputOf<UseCaseDef<S>>> {
    return result.ok ? result : err(ErrorDef.serialize(result.error));
  }

  /**
   * Ответ UC из формы транспорта: ошибку восстанавливает Def из `errors` UC
   * или базовых ошибок ядра. Код или payload вне контракта (другая версия
   * сервиса) — `SERVER_INTERNAL`; сообщить о расхождении — дело клиента
   * транспорта (ядро не логирует).
   */
  restoreResult(
    serialized: SerializedResult,
  ): Result<OutputOf<UseCaseDef<S>>, UseCaseErrorOf<UseCaseDef<S>>> {
    if (serialized.ok) {
      // Выход проверил UC схемой при исполнении; транспорт его не меняет.
      return serialized as Result<OutputOf<UseCaseDef<S>>, never>;
    }
    const { code, payload } = serialized.error;
    const def = [...this.errors, ...Object.values(CoreErrors)].find(
      (e) => e.code === code,
    );
    const error = def?.restore(payload) ?? CoreErrors.SERVER_INTERNAL.make();
    // Def найден среди `errors` UC и ошибок ядра — ровно `UseCaseErrorOf`;
    // `find` по union списков тип кода не сужает.
    return err(error as UseCaseErrorOf<UseCaseDef<S>>);
  }

  aggregates(): readonly AnyAggregateDef[] {
    return [this.aggregate];
  }

  override referencedErrors(): readonly AnyErrorDef[] {
    return this.errors;
  }

  override schemas(): DefSchemas {
    return [
      ['input', this.input],
      ['output', this.output],
    ];
  }

  normalize(): NormalizedUseCase {
    return {
      dmg: this.dmg,
      ...this.texts(),
      type: this.type,
      aggregate: this.aggregate.name,
      callers: this.callers,
      policy: this.policy.normalize(),
      input: toJsonSchema(this.input),
      output: toJsonSchema(this.output),
      errors: this.errors.map((e) => e.code),
      rules: this.rules.map((r) => r.name),
      calls: this.calls.map((u) => u.name),
      emits: this.emits.map((e) => e.name),
    };
  }
}
