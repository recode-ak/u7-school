import type * as v from 'valibot';
import type { DefOf } from '../def/def';
import type { Err } from '../result/result';
import type { JsonSchema } from '../schema/json-schema';
import type { DomainError, ErrorKind } from './error';
import type { ErrorDef } from './error-def';

export type PayloadSchema = v.GenericSchema<unknown>;

/** Описание одной ошибки в группе `ErrorDef.define`. */
export type ErrorSpec = {
  readonly kind: ErrorKind;
  readonly label: string;
  readonly description: string;
  readonly payload?: PayloadSchema;
};

/** Схема payload спеки; не объявлена — `undefined`. */
export type SchemaOf<S extends ErrorSpec> = S extends {
  readonly payload: infer P extends PayloadSchema;
}
  ? P
  : undefined;

export type PayloadOf<S extends ErrorSpec> = S['payload'] extends PayloadSchema
  ? v.InferOutput<S['payload']>
  : undefined;

/** Аргументы `make`/`err`: payload, если объявлен, иначе ничего. */
export type PayloadArgs<S extends ErrorSpec> =
  S['payload'] extends PayloadSchema
    ? [payload: v.InferOutput<S['payload']>]
    : [];

/** Сериализуемая форма ошибки: имя графа — код. */
export type NormalizedError = {
  readonly dmg: 'error';
  readonly code: string;
  readonly kind: ErrorKind;
  readonly label: string;
  readonly description: string;
  readonly payload: JsonSchema | undefined;
};

/** Любой манифест ошибки — для списков `errors` и проверок графа. */
export type AnyErrorDef = DefOf<'error', NormalizedError> & {
  readonly code: string;
  readonly kind: ErrorKind;
  readonly payload?: PayloadSchema;
  make(...args: never[]): DomainError;
  err(...args: never[]): Err<DomainError>;
};

/** Тип значения ошибки по её Def. */
export type ErrorOf<D extends AnyErrorDef> = ReturnType<D['make']>;

type Code<P extends string, K> = P extends ''
  ? K & string
  : `${P}_${K & string}`;

export type ErrorGroup<
  P extends string,
  M extends Record<string, ErrorSpec>,
> = {
  readonly [K in keyof M]: ErrorDef<Code<P, K>, M[K]>;
};
