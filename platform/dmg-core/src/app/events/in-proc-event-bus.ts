import type { AnyEventDef } from '#core/domain/events/event-def';
import type { Logger } from '../context';
import type { EventBus } from './event-bus';
import type { EnvelopeOf, EventEnvelope } from './event-envelope';

type Handler = (envelope: EventEnvelope) => Promise<void>;

/** Источник записей шины в логгере. */
const SOURCE = 'event-bus';

/**
 * Шина событий в процессе: доставляет конверт подписчикам по имени события
 * в порядке подписки, не дожидаясь обработчиков. Сбой обработчика
 * (исключение или отказ промиса) уходит в `logger.error` (в `meta` —
 * событие, `eventId`, текст и стек ошибки) и не мешает остальным; `publish` не бросает.
 */
export class InProcEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(private readonly logger: Logger) {}

  publish(envelope: EventEnvelope): void {
    // Снимок: подписка и отписка из обработчика не меняют текущую доставку.
    for (const handler of [...(this.handlers.get(envelope.name) ?? [])]) {
      this.deliver(handler, envelope);
    }
  }

  subscribe<D extends AnyEventDef>(
    def: D,
    handler: (envelope: EnvelopeOf<D>) => Promise<void>,
  ): () => void {
    // Имя события уникально (D-10): конверт под этим именем имеет тип def.
    const wrapped: Handler = (envelope) => handler(envelope as EnvelopeOf<D>);
    const set = this.handlers.get(def.name) ?? new Set();
    set.add(wrapped);
    this.handlers.set(def.name, set);
    return () => {
      set.delete(wrapped);
      // Пустой набор не держим; сверка — набор мог смениться после переподписки.
      if (set.size === 0 && this.handlers.get(def.name) === set) {
        this.handlers.delete(def.name);
      }
    };
  }

  private deliver(handler: Handler, envelope: EventEnvelope): void {
    try {
      handler(envelope).catch((error: unknown) => this.fail(envelope, error));
    } catch (error) {
      this.fail(envelope, error);
    }
  }

  private fail(envelope: EventEnvelope, error: unknown): void {
    const text = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      SOURCE,
      `обработчик события ${envelope.name} упал: ${text}`,
      {
        event: envelope.name,
        eventId: envelope.eventId,
        error: text,
        ...(stack === undefined ? {} : { stack }),
      },
    );
  }
}
