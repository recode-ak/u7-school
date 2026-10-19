import type * as v from 'valibot';
import type { CallerKind } from '../../kernel/caller/caller';
import type { CoreError } from '../../kernel/errors/core-errors';
import type { AnyErrorDef, ErrorOf } from '../../kernel/errors/define-errors';
import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef } from '../events/define-events';
import type { AnyRule } from '../policy/policy';

type Common = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly aggregate: AnyAggregateDef;
  /** Допустимые вызывающие (MAN-11); остальные получают `UNAUTHORIZED`. */
  readonly callers: readonly [CallerKind, ...CallerKind[]];
  readonly policy?: AnyRule;
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

export type UseCaseDef<S extends UseCaseSpec> = S & {
  readonly dmg: 'useCase';
};

export type AnyUseCaseDef = UseCaseDef<UseCaseSpec>;

/** Вход UC — то, что передаёт вызывающий (до валидации схемой). */
export type InputOf<D extends AnyUseCaseDef> = v.InferInput<D['input']>;

/** Выход UC — то, что получает вызывающий (после валидации схемой). */
export type OutputOf<D extends AnyUseCaseDef> = v.InferOutput<D['output']>;

/** Ошибки UC: объявленные в `errors` + базовые ядра (ERR-02). */
export type UseCaseErrorOf<D extends AnyUseCaseDef> =
  | ErrorOf<D['errors'][number]>
  | CoreError;

export function defineUseCase<const S extends UseCaseSpec>(
  spec: S,
): UseCaseDef<S> {
  return { ...spec, dmg: 'useCase' };
}
