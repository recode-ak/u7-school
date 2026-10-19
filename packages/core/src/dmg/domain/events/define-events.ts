import type * as v from 'valibot';

type PayloadSchema = v.GenericSchema<unknown>;

/** Доменное событие: факт, который накопил агрегат. Конверт добавляет UoW. */
export type DomainEvent<N extends string = string, P = unknown> = {
  readonly name: N;
  readonly payload: P;
};

/** Описание одного события в группе `defineEvents`. */
export type EventSpec = {
  readonly label: string;
  readonly description: string;
  readonly payload: PayloadSchema;
};

/** Манифест события: декларация + фабрика значения. */
export type EventDef<N extends string, S extends EventSpec> = {
  readonly dmg: 'event';
  readonly name: N;
  readonly label: string;
  readonly description: string;
  readonly payload: S['payload'];
  make(
    payload: v.InferOutput<S['payload']>,
  ): DomainEvent<N, v.InferOutput<S['payload']>>;
};

/** Любой манифест события — для `on`/`emits` и проверок графа. */
export type AnyEventDef = {
  readonly dmg: 'event';
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly payload: PayloadSchema;
  make(payload: never): DomainEvent;
};

/**
 * Тип значения события по его Def. Структурно, а не `ReturnType<D['make']>`:
 * для дженерика `D` TS не сводит `ReturnType` к `DomainEvent`.
 */
export type EventOf<D extends AnyEventDef> = DomainEvent<
  D['name'],
  v.InferOutput<D['payload']>
>;

/** FQN-префикс группы: `module.aggregate` (D-10). */
export type EventPrefix = `${string}.${string}`;

export type EventGroup<
  P extends EventPrefix,
  M extends Record<string, EventSpec>,
> = {
  readonly [K in keyof M]: EventDef<`${P}.${K & string}`, M[K]>;
};

/**
 * Группа событий агрегата. Имя — `module.aggregate.event` (D-10, MAN-08:
 * совпадение префикса с модулем и агрегатом проверяет `arch:check`).
 */
export function defineEvents<
  const P extends EventPrefix,
  const M extends Record<string, EventSpec>,
>(prefix: P, specs: M): EventGroup<P, M> {
  const group: Record<string, AnyEventDef> = {};
  for (const [key, spec] of Object.entries(specs)) {
    group[key] = eventDef(`${prefix}.${key}`, spec);
  }
  // Ключи и типы группы задаёт сигнатура: рантайм-сборка через Object.entries
  // не выражается в mapped type без утверждения.
  return group as EventGroup<P, M>;
}

function eventDef(name: string, spec: EventSpec): AnyEventDef {
  return {
    dmg: 'event',
    name,
    label: spec.label,
    description: spec.description,
    payload: spec.payload,
    make: (payload: unknown): DomainEvent => ({ name, payload }),
  };
}
