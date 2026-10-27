import type { EventBus } from '../app/events/event-bus';
import type { EnvelopeOf, EventEnvelope } from '../app/events/event-envelope';
import type { AnyEventDef } from '../domain/events/event-def';

/** Шина для тестов: только запоминает опубликованное в `published`. */
export class RecordingBus implements EventBus {
  constructor(readonly published: EventEnvelope[] = []) {}

  publish(envelope: EventEnvelope): void {
    this.published.push(envelope);
  }

  subscribe<D extends AnyEventDef>(
    _def: D,
    _handler: (envelope: EnvelopeOf<D>) => Promise<void>,
  ): () => void {
    return () => {};
  }
}

/**
 * Шина в памяти: запоминает опубликованное и доставляет конверт подписчикам
 * по имени события, не дожидаясь обработчиков (как боевая шина).
 */
export class MemoryBus extends RecordingBus {
  private readonly handlers = new Map<
    string,
    Set<(envelope: EventEnvelope) => Promise<void>>
  >();

  override publish(envelope: EventEnvelope): void {
    super.publish(envelope);
    for (const handler of this.handlers.get(envelope.name) ?? []) {
      void handler(envelope);
    }
  }

  override subscribe<D extends AnyEventDef>(
    def: D,
    handler: (envelope: EnvelopeOf<D>) => Promise<void>,
  ): () => void {
    // Имя события уникально (D-10): конверт под этим именем имеет тип def.
    const wrapped = (envelope: EventEnvelope) =>
      handler(envelope as EnvelopeOf<D>);
    const set = this.handlers.get(def.name) ?? new Set();
    set.add(wrapped);
    this.handlers.set(def.name, set);
    return () => {
      set.delete(wrapped);
    };
  }
}
