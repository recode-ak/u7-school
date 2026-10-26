import type * as v from 'valibot';
import type { DefOf, DefTexts } from '#core/kernel/def/def';
import type { JsonSchema } from '#core/kernel/schema/json-schema';
import type { EventDef } from './event-def';

export type PayloadSchema = v.GenericSchema<unknown>;

/** Доменное событие: факт, который накопил агрегат. Конверт добавляет UoW. */
export type DomainEvent<N extends string = string, P = unknown> = {
  readonly name: N;
  readonly payload: P;
};

/** Описание одного события в группе `EventDef.define`. */
export type EventSpec = {
  readonly label: string;
  readonly description: string;
  readonly payload: PayloadSchema;
};

/** Сериализуемая форма события. */
export type NormalizedEvent = DefTexts & {
  readonly dmg: 'event';
  readonly payload: JsonSchema;
};

/** Любой манифест события — для `on`/`emits` и проверок графа. */
export type AnyEventDef = DefOf<'event', NormalizedEvent> & {
  readonly payload: PayloadSchema;
  make(payload: never): DomainEvent;
};

/**
 * Тип значения события по его Def; для union Def — union событий.
 * Структурно, а не `ReturnType<D['make']>`: для дженерика `D` TS не сводит
 * `ReturnType` к `DomainEvent`.
 */
export type EventOf<D extends AnyEventDef> = D extends AnyEventDef
  ? DomainEvent<D['name'], v.InferOutput<D['payload']>>
  : never;

/** FQN-префикс группы: `module.aggregate` (D-10). */
export type EventPrefix = `${string}.${string}`;

export type EventGroup<
  P extends EventPrefix,
  M extends Record<string, EventSpec>,
> = {
  readonly [K in keyof M]: EventDef<`${P}.${K & string}`, M[K]>;
};
