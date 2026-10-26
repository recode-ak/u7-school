import type {
  AnyEventDef,
  DomainEvent,
  EventOf,
} from '#core/domain/events/event-def';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { Cause } from '#core/kernel/trace/trace';

/**
 * Опубликованное событие: доменный факт + конверт. Конверт добавляет UoW
 * при фиксации; домен о нём не знает (caller.md §2 п. 6). Вызывающего в
 * конверте нет (D-43, Р7): «кто» — в записи породившей операции в логе
 * операций, найти её можно по `eventId` (`OperationRecord.events`).
 */
export type EventEnvelope<E extends DomainEvent = DomainEvent> = E & {
  readonly eventId: string;
  readonly occurredAt: Timestamp;
  readonly aggregateId: string;
  /** Что непосредственно вызвало операцию: запрос, событие, прогон Job. */
  readonly cause: Cause;
  /** Сквозной id цепочки от точки входа. */
  readonly correlationId: string;
};

/** Конверт события по его Def. */
export type EnvelopeOf<D extends AnyEventDef> = EventEnvelope<EventOf<D>>;

/**
 * Опубликованное событие в отчёте фиксации (`uow.commit()`) и в записи лога
 * операций: имя и id конверта — полное событие ищется по `eventId`.
 */
export type PublishedEvent = {
  readonly name: string;
  readonly eventId: string;
};
