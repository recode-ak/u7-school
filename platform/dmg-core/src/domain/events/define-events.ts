import { EventDef } from './event-def';
import type { EventGroup, EventPrefix, EventSpec } from './event-def.types';

export { EventDef } from './event-def';
export type {
  AnyEventDef,
  DomainEvent,
  EventGroup,
  EventOf,
  EventPrefix,
  EventSpec,
} from './event-def.types';

/**
 * Группа событий агрегата — обёртка над `EventDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineEvents<
  const P extends EventPrefix,
  const M extends Record<string, EventSpec>,
>(prefix: P, specs: M): EventGroup<P, M> {
  return EventDef.define(prefix, specs);
}
