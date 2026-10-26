import type * as v from 'valibot';
import { Def, type DefSchemas } from '#core/kernel/def/def';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import type {
  DomainEvent,
  EventGroup,
  EventPrefix,
  EventSpec,
  NormalizedEvent,
} from './event-def.types';

export type {
  AnyEventDef,
  DomainEvent,
  EventGroup,
  EventOf,
  EventPrefix,
  EventSpec,
  NormalizedEvent,
} from './event-def.types';

/** Манифест события: декларация + фабрика значения. */
export class EventDef<
  const N extends string = string,
  const S extends EventSpec = EventSpec,
> extends Def<N> {
  readonly dmg = 'event';
  readonly payload: S['payload'];

  constructor(name: N, spec: S) {
    super({ name, label: spec.label, description: spec.description });
    this.payload = spec.payload;
  }

  /**
   * Группа событий агрегата. Имя — `module.aggregate.event` (D-10, MAN-08:
   * совпадение префикса с модулем и агрегатом проверяет `arch:check`).
   */
  static define<
    const P extends EventPrefix,
    const M extends Record<string, EventSpec>,
  >(prefix: P, specs: M): EventGroup<P, M> {
    const group: Record<string, EventDef> = {};
    for (const [key, spec] of Object.entries(specs)) {
      group[key] = new EventDef(`${prefix}.${key}`, spec);
    }
    // Ключи и типы группы задаёт сигнатура: рантайм-сборка через Object.entries
    // не выражается в mapped type без утверждения.
    return group as EventGroup<P, M>;
  }

  make(
    payload: v.InferOutput<S['payload']>,
  ): DomainEvent<N, v.InferOutput<S['payload']>> {
    return { name: this.name, payload };
  }

  normalize(): NormalizedEvent {
    return {
      dmg: this.dmg,
      ...this.texts(),
      payload: toJsonSchema(this.payload),
    };
  }

  override schemas(): DefSchemas {
    return [['payload', this.payload]];
  }
}
