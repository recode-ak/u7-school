import type * as v from 'valibot';
import type { DefOf, DefTexts } from '#core/kernel/def/def';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import type { BaseEntityFields } from '#core/kernel/fields/fields';
import type { JsonSchema } from '#core/kernel/schema/json-schema';
import type { AnyEventDef } from '../events/event-def';

/** Поля, без которых нет entity, — выводятся из `BaseEntityFields`. */
export type EntityBase = {
  [K in keyof typeof BaseEntityFields]: v.InferOutput<
    (typeof BaseEntityFields)[K]
  >;
};

/** Схема состояния агрегата: entity поверх `BaseEntityFields`. */
export type StateSchema = v.GenericSchema<unknown, EntityBase>;

/** Значения поля `status` состояния; `never`, если статусов нет. */
export type StatusOf<S extends StateSchema> =
  v.InferOutput<S> extends { status: infer X extends string } ? X : never;

/** Ошибка отказа перехода — без payload: её возвращает база агрегата. */
export type RejectErrorDef = AnyErrorDef & { readonly payload: undefined };

/**
 * Переход статуса операцией агрегата (ключ — имя метода Ar). `rejects` —
 * отказ для каждого статуса вне `from`: Def — единственное место правил
 * жизненного цикла, метод Ar их не повторяет.
 */
export type Transition<X extends string> = {
  readonly from: readonly X[];
  readonly to: X;
  readonly rejects: { readonly [K in X]?: RejectErrorDef };
};

/** Отказы каждого перехода покрывают все статусы вне его `from`. */
export type RejectsComplete<A> = A extends {
  readonly statuses: infer St;
  readonly transitions: infer T;
}
  ? {
      readonly transitions: {
        readonly [K in keyof T]: T[K] extends {
          readonly from: readonly (infer F)[];
        }
          ? {
              readonly rejects: {
                readonly [X in Exclude<keyof St & string, F>]: RejectErrorDef;
              };
            }
          : never;
      };
    }
  : unknown;

type Lifecycle<X extends string> = {
  readonly statuses: { readonly [K in X]: { readonly label: string } };
  readonly transitions: { readonly [op: string]: Transition<X> };
};

/** Описание агрегата для `AggregateDef.define`. */
export type AggregateSpec<S extends StateSchema = StateSchema> = DefTexts & {
  readonly state: S;
  readonly events: { readonly [key: string]: AnyEventDef };
  readonly errors: { readonly [key: string]: AnyErrorDef };
} & ([StatusOf<S>] extends [never] ? object : Lifecycle<StatusOf<S>>);

/** Поле жизненного цикла спеки; без статусов — `undefined`. */
export type LifecycleField<
  A,
  K extends 'statuses' | 'transitions',
> = A extends { readonly [P in K]: infer X } ? X : undefined;

/** Переход: отказы — коды ошибок по статусам вне `from`. */
export type NormalizedTransition = {
  readonly from: readonly string[];
  readonly to: string;
  readonly rejects: Readonly<Record<string, string>>;
};

/** Сериализуемая форма агрегата. */
export type NormalizedAggregate = DefTexts & {
  readonly dmg: 'aggregate';
  readonly state: JsonSchema;
  readonly statuses: Lifecycle<string>['statuses'] | undefined;
  readonly transitions:
    | Readonly<Record<string, NormalizedTransition>>
    | undefined;
  readonly events: readonly string[];
  readonly errors: readonly string[];
};

/** Любой манифест агрегата — для модуля, UC и проверок графа. */
export type AnyAggregateDef = DefOf<'aggregate', NormalizedAggregate> & {
  readonly state: StateSchema;
  readonly events: { readonly [key: string]: AnyEventDef };
  readonly errors: { readonly [key: string]: AnyErrorDef };
  readonly statuses?: Lifecycle<string>['statuses'];
  readonly transitions?: Lifecycle<string>['transitions'];
};
