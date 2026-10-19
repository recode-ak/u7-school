import type * as v from 'valibot';
import type { AnyErrorDef } from '../../kernel/errors/define-errors';
import type { Timestamp } from '../../kernel/time/timestamp';
import type { AnyEventDef } from '../events/define-events';

/** Поля, без которых нет entity: идентичность и метки времени. */
export type EntityBase = {
  uuid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Схема состояния агрегата: entity поверх `BaseEntityFields`. */
export type StateSchema = v.GenericSchema<unknown, EntityBase>;

/** Значения поля `status` состояния; `never`, если статусов нет. */
export type StatusOf<S extends StateSchema> =
  v.InferOutput<S> extends { status: infer X extends string } ? X : never;

/** Переход статуса операцией агрегата (ключ — имя метода Ar). */
export type Transition<X extends string> = {
  readonly from: readonly X[];
  readonly to: X;
};

type Lifecycle<X extends string> = {
  readonly statuses: { readonly [K in X]: { readonly label: string } };
  readonly transitions: { readonly [op: string]: Transition<X> };
};

/** Описание агрегата для `defineAggregate`. */
export type AggregateSpec<S extends StateSchema = StateSchema> = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly state: S;
  readonly events: { readonly [key: string]: AnyEventDef };
  readonly errors: { readonly [key: string]: AnyErrorDef };
} & ([StatusOf<S>] extends [never] ? object : Lifecycle<StatusOf<S>>);

/** Манифест агрегата. */
export type AggregateDef<A extends AggregateSpec> = A & {
  readonly dmg: 'aggregate';
};

/** Любой манифест агрегата — для модуля, UC и проверок графа. */
export type AnyAggregateDef = AggregateSpec & {
  readonly dmg: 'aggregate';
  readonly statuses?: Lifecycle<string>['statuses'];
  readonly transitions?: Lifecycle<string>['transitions'];
};

/**
 * Манифест агрегата: схема entity, статусы и переходы (если в состоянии есть
 * `status`, статусы обязаны покрыть все его значения), группы событий и ошибок.
 */
export function defineAggregate<
  const S extends StateSchema,
  const A extends AggregateSpec<S>,
>(spec: A & AggregateSpec<S>): AggregateDef<A> {
  return { ...spec, dmg: 'aggregate' };
}
