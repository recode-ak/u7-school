import type { DomainEvent as LegacyEvent } from '@u7-scl/core/domain';
import { type DomainEvent, SystemCaller, type Timestamp } from 'dmg-core';
import type { EventBus } from 'dmg-core/app';

export type WishPublication = {
  /** События Def: из `pullEvents()` агрегата или `WishEvents.*.make`. */
  readonly events: readonly DomainEvent[];
  readonly aggregateId: string;
  /** Имя ER — источник системного вызывающего. */
  readonly source: string;
  /** Legacy-событие, на которое реагирует ER: причина и цепочка. */
  readonly cause: LegacyEvent;
  readonly at: Timestamp;
};

/**
 * Публикация событий `wish` из legacy-ER (до Ф10, где конверт строит
 * UoW `ReactionFromDef`). Конверт — по образцу UoW: причина и
 * `correlationId` — событие-причина; у legacy-события нет своей цепочки и
 * вызывающего (как в `fromLegacy` моста).
 *
 * `bus` — `legacyEventBus(resolve.eventBus)`: legacy-подписчики (stories)
 * получают FQN как `eventName`. Конверт DMG мост держит в своём
 * экземпляре — подписчики DMG других модулей увидят его, когда wiring
 * раздаст один экземпляр (Ф12); сейчас таких подписчиков нет.
 */
export function publishWishEvents(
  bus: EventBus,
  { events, aggregateId, source, cause, at }: WishPublication,
): void {
  for (const event of events) {
    bus.publish({
      ...event,
      eventId: crypto.randomUUID(),
      occurredAt: at,
      aggregateId,
      caller: new SystemCaller({
        kind: 'eventReaction',
        module: 'wish',
        name: source,
      }),
      cause: { kind: 'event', eventId: cause.eventId },
      correlationId: cause.eventId,
    });
  }
}
