import type {
  AnyEventDef,
  DomainEvent,
  EventOf,
} from '#dmg/domain/events/define-events';
import type { Caller } from '#dmg/kernel/caller/caller';
import type { Timestamp } from '#dmg/kernel/time/timestamp';
import type { Cause } from '../trace';

/**
 * Опубликованное событие: доменный факт + конверт. Конверт добавляет UoW
 * при фиксации; домен о нём не знает (caller.md §2 п. 4).
 */
export type EventEnvelope<E extends DomainEvent = DomainEvent> = E & {
  readonly eventId: string;
  readonly occurredAt: Timestamp;
  readonly aggregateId: string;
  /** Кто вызвал операцию, породившую событие. */
  readonly caller: Caller<unknown>;
  /** Что непосредственно вызвало операцию: запрос, событие, прогон Job. */
  readonly cause: Cause;
  /** Сквозной id цепочки от точки входа. */
  readonly correlationId: string;
};

/** Конверт события по его Def. */
export type EnvelopeOf<D extends AnyEventDef> = EventEnvelope<EventOf<D>>;
