import type * as v from 'valibot';
import { type Err, err } from '../result/result';
import type { DomainError, ErrorKind } from './error';

type PayloadSchema = v.GenericSchema<unknown>;

/** Описание одной ошибки в группе `defineErrors`. */
export type ErrorSpec = {
  readonly kind: ErrorKind;
  readonly label: string;
  readonly description: string;
  readonly payload?: PayloadSchema;
};

type PayloadOf<S extends ErrorSpec> = S['payload'] extends PayloadSchema
  ? v.InferOutput<S['payload']>
  : undefined;

type PayloadArgs<S extends ErrorSpec> = S['payload'] extends PayloadSchema
  ? [payload: v.InferOutput<S['payload']>]
  : [];

/** Манифест ошибки: декларация + фабрика значения. */
export type ErrorDef<C extends string, S extends ErrorSpec> = {
  readonly dmg: 'error';
  readonly code: C;
  readonly kind: S['kind'];
  readonly label: string;
  readonly description: string;
  readonly payload?: PayloadSchema;
  make(...args: PayloadArgs<S>): DomainError<C, S['kind'], PayloadOf<S>>;
  err(...args: PayloadArgs<S>): Err<DomainError<C, S['kind'], PayloadOf<S>>>;
};

/** Любой манифест ошибки — для списков `errors` и проверок графа. */
export type AnyErrorDef = {
  readonly dmg: 'error';
  readonly code: string;
  readonly kind: ErrorKind;
  readonly label: string;
  readonly description: string;
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

/**
 * Группа ошибок агрегата. Код — `<ПРЕФИКС>_<КЛЮЧ>` (ERR-04: UPPER_SNAKE
 * с префиксом сущности, уникальность проверяет `arch:check`).
 */
export function defineErrors<
  const P extends string,
  const M extends Record<string, ErrorSpec>,
>(prefix: P, specs: M): ErrorGroup<P, M> {
  return buildErrors(prefix, specs);
}

/** Сборка группы; пустой префикс — только для базовых ошибок ядра. */
export function buildErrors<
  const P extends string,
  const M extends Record<string, ErrorSpec>,
>(prefix: P, specs: M): ErrorGroup<P, M> {
  const group: Record<string, AnyErrorDef> = {};
  for (const [key, spec] of Object.entries(specs)) {
    const code = prefix === '' ? key : `${prefix}_${key}`;
    group[key] = errorDef(code, spec);
  }
  // Ключи и типы группы задаёт сигнатура: рантайм-сборка через Object.entries
  // не выражается в mapped type без утверждения.
  return group as ErrorGroup<P, M>;
}

function errorDef(code: string, spec: ErrorSpec): AnyErrorDef {
  const make = (payload?: unknown): DomainError => ({
    code,
    kind: spec.kind,
    label: spec.label,
    description: spec.description,
    payload,
  });
  return {
    dmg: 'error',
    code,
    kind: spec.kind,
    label: spec.label,
    description: spec.description,
    payload: spec.payload,
    make,
    err: (payload?: unknown) => err(make(payload)),
  };
}
