import type * as v from 'valibot';
import type { CallerKind } from '#core/kernel/caller/caller';
import type { DefTexts } from '#core/kernel/def/def';
import type { CoreError } from '#core/kernel/errors/core-errors';
import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/error-def';
import type { JsonSchema } from '#core/kernel/schema/json-schema';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventDef } from '../events/event-def';
import type { AnyRule, NormalizedRule } from '../policy/rule';
import type { AnyDomainRule } from '../rules/domain-rule-def';
import type { UseCaseDef } from './use-case-def';

type Common = DefTexts & {
  readonly aggregate: AnyAggregateDef;
  /** Допустимые вызывающие (MAN-11); остальные получают `UNAUTHORIZED`. */
  readonly callers: readonly [CallerKind, ...CallerKind[]];
  /** Право на действие; без ограничений — явно `allowAll`. */
  readonly policy: AnyRule;
  /**
   * Доменные правила (D-40): допустимость действия при текущих состояниях,
   * без субъекта. Проверяются после Policy; ошибка каждого правила
   * объявляется в `errors`.
   */
  readonly rules?: readonly AnyDomainRule[];
  /**
   * UC других модулей (из `dependsOn`), которые операция вызывает через их
   * фасады (D-42, MAN-05). Только UC с `'system'` в `callers` — тип
   * (`SystemCalls` в `UseCaseDef.define`), согласованность с графом —
   * `DefChecker`.
   */
  readonly calls?: readonly AnyUseCaseDef[];
  readonly input: v.GenericSchema;
  readonly output: v.GenericSchema;
  /** Собственные ошибки и ошибки зависимостей; базовые подмешивает ядро. */
  readonly errors: readonly AnyErrorDef[];
};

/** Контракт UC: command меняет состояние, query только читает. */
export type UseCaseSpec = Common &
  (
    | { readonly type: 'command'; readonly emits?: readonly AnyEventDef[] }
    | { readonly type: 'query'; readonly emits?: readonly [] }
  );

/**
 * Любой Def UC — структурный тип публичных членов: конкретный Def
 * сравнивается с ним по полям, а не по вариантности параметра `S`
 * (условный `Declared` делает её неизмеримой).
 */
export type AnyUseCaseDef = { readonly [K in keyof UseCaseDef]: UseCaseDef[K] };

/** Необязательный список спеки: не объявлен — пустой кортеж. */
export type Declared<S, K extends string> = [K] extends [keyof S]
  ? NonNullable<S[K & keyof S]>
  : readonly [];

/**
 * `calls` Def: объявленные UC; не объявлены — пустой кортеж, чтобы
 * `OperationFromDef.call` не пропускал ни одного UC (D-43). Общий тип
 * (`Any*Def`) — любой список.
 */
export type DeclaredCalls<
  S extends { readonly calls?: readonly AnyUseCaseDef[] },
> = 'calls' extends keyof S ? NonNullable<S['calls']> : readonly [];

/** Вход UC — то, что передаёт вызывающий (до валидации схемой). */
export type InputOf<D extends AnyUseCaseDef> = v.InferInput<D['input']>;

/** Выход UC — то, что получает вызывающий (после валидации схемой). */
export type OutputOf<D extends AnyUseCaseDef> = v.InferOutput<D['output']>;

/** Ошибки UC: объявленные в `errors` + базовые ядра (ERR-02). */
export type UseCaseErrorOf<D extends AnyUseCaseDef> =
  | ErrorOf<D['errors'][number]>
  | CoreError;

/**
 * Def с `'system'` в `callers` — его может вызвать операция другого модуля
 * через фасад (D-43). Распределяется по union Def.
 */
export type SystemCallableUc<D> = D extends {
  readonly callers: readonly (infer K)[];
}
  ? 'system' extends K
    ? D
    : never
  : never;

/**
 * Проверка `calls` спецификации UC/ER/Job: UC, который система не может
 * вызвать (нет `'system'` в `callers`), становится `never` на своём месте —
 * ошибка компиляции указывает на него (D-43, Р7).
 */
export type SystemCalls<S> = S extends {
  readonly calls: infer C extends readonly AnyUseCaseDef[];
}
  ? { readonly calls: { readonly [K in keyof C]: SystemCallableUc<C[K]> } }
  : unknown;

/** Сериализуемая форма UC. */
export type NormalizedUseCase = DefTexts & {
  readonly dmg: 'useCase';
  readonly type: 'command' | 'query';
  readonly aggregate: string;
  readonly callers: readonly CallerKind[];
  readonly policy: NormalizedRule;
  readonly input: JsonSchema;
  readonly output: JsonSchema;
  readonly errors: readonly string[];
  /** Имена доменных правил UC. */
  readonly rules: readonly string[];
  /** Имена UC других модулей, которые UC вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};
