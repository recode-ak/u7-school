import type {
  AnyEventDef,
  DomainEvent,
  EventOf,
} from '../../domain/events/define-events';
import type { Caller } from '../../kernel/caller/caller';
import type { Timestamp } from '../../kernel/time/timestamp';

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
  /** `eventId` события-причины, если операция — реакция на него. */
  readonly causationId?: string;
};

/** Конверт события по его Def. */
export type EnvelopeOf<D extends AnyEventDef> = EventEnvelope<EventOf<D>>;
