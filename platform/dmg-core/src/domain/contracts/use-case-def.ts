import type { DefSchemas } from '#core/kernel/def/def';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import { OperationDef } from './operation-def';
import type { Declared } from './operation-def.types';
import type {
  NormalizedUseCase,
  SystemCalls,
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
