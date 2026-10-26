import type * as v from 'valibot';
import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/error-def';
import type { EventOf } from '../events/event-def';
import type { AnyAggregateDef } from './define-aggregate';

/** Состояние агрегата по его Def. */
export type StateOf<D extends AnyAggregateDef> = v.InferOutput<D['state']>;

/** Union событий группы агрегата. */
export type EventsOf<D extends AnyAggregateDef> = {
  [K in keyof D['events']]: EventOf<D['events'][K]>;
}[keyof D['events']];

/** Union ошибок группы агрегата. */
export type ErrorsOf<D extends AnyAggregateDef> = {
  [K in keyof D['errors']]: ErrorOf<D['errors'][K]>;
}[keyof D['errors']];

/** Объявленные переходы агрегата (`transitions` в Def). */
type TransitionsOf<D extends AnyAggregateDef> = NonNullable<D['transitions']>;

/** Имя перехода агрегата — ключ `transitions` в Def. */
export type TransitionOf<D extends AnyAggregateDef> = keyof TransitionsOf<D> &
  string;

/** Отказы перехода `K`: ошибки из его `rejects`. */
export type RejectOf<
  D extends AnyAggregateDef,
  K extends TransitionOf<D>,
> = TransitionsOf<D>[K] extends { readonly rejects: infer J }
  ? ErrorOf<Extract<J[keyof J], AnyErrorDef>>
  : never;
