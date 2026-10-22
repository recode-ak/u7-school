import type { DomainEvent as LegacyEvent } from '@u7-scl/core/domain';
import type { DomainEvent, Timestamp } from 'dmg-core';
import { type EventBus, Trace } from 'dmg-core/app';

export type WishPublication = {
  /** События Def: из `pullEvents()` агрегата или `WishEvents.*.make`. */
  readonly events: readonly DomainEvent[];
  readonly aggregateId: string;
  /** Legacy-событие, на которое реагирует ER: причина и цепочка. */
  readonly cause: LegacyEvent;
  readonly at: Timestamp;
};

/**
 * Публикация событий `wish` из legacy-ER (до Ф10, где конверт строит
 * UoW `ReactionFromDef`). Конверт — по образцу UoW: причина и
 * `correlationId` — событие-причина; у legacy-события нет своей цепочки
 * (как в `fromLegacy` моста). Вызывающего в конверте нет (D-43, Р7);
 * legacy-подписчики его и не получали — `LegacyEvent` его не несёт.
 *
 * `bus` — `legacyEventBus(resolve.eventBus)`: legacy-подписчики (stories)
 * получают FQN как `eventName`. Конверт DMG мост держит в своём
 * экземпляре — подписчики DMG других модулей увидят его, когда wiring
 * раздаст один экземпляр (Ф12); сейчас таких подписчиков нет.
 */
export function publishWishEvents(
  bus: EventBus,
  { events, aggregateId, cause, at }: WishPublication,
): void {
  const trace = Trace.fromEvent({
    eventId: cause.eventId,
    correlationId: cause.eventId,
  }).toEnvelope();
  for (const event of events) {
    bus.publish({
      ...event,
      eventId: crypto.randomUUID(),
      occurredAt: at,
      aggregateId,
      ...trace,
    });
  }
}
