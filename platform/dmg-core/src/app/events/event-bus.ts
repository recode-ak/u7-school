import type { AnyEventDef } from '#core/domain/events/event-def';
import type { EnvelopeOf, EventEnvelope } from './event-envelope';

/** Шина событий DMG: публикует конверты, подписка — по Def события. */
export type EventBus = {
  publish(envelope: EventEnvelope): void;
  subscribe<D extends AnyEventDef>(
    def: D,
    handler: (envelope: EnvelopeOf<D>) => Promise<void>,
  ): () => void;
};
