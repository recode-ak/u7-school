// Прототип Def-класса (трек dmg-core-oop, Фаза 0): проверка, что
// `XxxDef.define` сохраняет вывод литеральных типов. Не продакшен-код:
// заменяется настоящим `Def` в Фазе 1.
import type * as v from 'valibot';
import type { CallerKind } from '#core/kernel/caller/caller';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef } from '../events/event-def';
import type { AnyRule } from '../policy/policy';
import type { AnyDomainRule } from '../rules/domain-rule';

type DefSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
};

abstract class ProtoDef {
  abstract readonly dmg: string;
  readonly name: string;
  readonly label: string;
  readonly description: string;

  constructor(spec: DefSpec) {
    this.name = spec.name;
    this.label = spec.label;
    this.description = spec.description;
  }
}

export type ProtoUseCaseSpec = DefSpec & {
  readonly type: 'command' | 'query';
  readonly aggregate: AnyAggregateDef;
  readonly callers: readonly [CallerKind, ...CallerKind[]];
  readonly policy: AnyRule;
  readonly rules?: readonly AnyDomainRule[];
  readonly calls?: readonly AnyProtoUseCaseDef[];
  readonly input: v.GenericSchema;
  readonly output: v.GenericSchema;
  readonly errors: readonly AnyErrorDef[];
  readonly emits?: readonly AnyEventDef[];
};

/** Необязательный список спеки: не объявлен — пустой кортеж. */
type Declared<S, K extends string> = K extends keyof S
  ? NonNullable<S[K]>
  : readonly [];

export class ProtoUseCaseDef<
  const S extends ProtoUseCaseSpec = ProtoUseCaseSpec,
> extends ProtoDef {
  readonly dmg = 'useCase';
  readonly type: S['type'];
  readonly aggregate: S['aggregate'];
  readonly callers: S['callers'];
  readonly policy: S['policy'];
  readonly rules: Declared<S, 'rules'>;
  readonly calls: Declared<S, 'calls'>;
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
    this.calls = (spec.calls ?? []) as Declared<S, 'calls'>;
    this.input = spec.input;
    this.output = spec.output;
    this.errors = spec.errors;
    this.emits = (spec.emits ?? []) as Declared<S, 'emits'>;
  }

  /** Вариант 2: `define` вида — литералы спеки выводятся через `const S`. */
  static define<const S extends ProtoUseCaseSpec>(
    spec: S & SystemCalls<S>,
  ): ProtoUseCaseDef<S> {
    return new ProtoUseCaseDef<S>(spec);
  }
}

type SystemCallableUc<D> = D extends {
  readonly callers: readonly (infer K)[];
}
  ? 'system' extends K
    ? D
    : never
  : never;

type SystemCalls<S> = S extends {
  readonly calls: infer C extends readonly AnyProtoUseCaseDef[];
}
  ? { readonly calls: { readonly [K in keyof C]: SystemCallableUc<C[K]> } }
  : unknown;

/**
 * Любой Def UC — структурный тип публичных членов: конкретный Def
 * сравнивается с ним по полям, а не по вариантности параметра `S`
 * (условный `Declared` делает её неизмеримой).
 */
export type AnyProtoUseCaseDef = {
  readonly [K in keyof ProtoUseCaseDef]: ProtoUseCaseDef[K];
};
