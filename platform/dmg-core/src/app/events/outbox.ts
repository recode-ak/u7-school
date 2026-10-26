import type { EventBus } from './event-bus';
import type { EventEnvelope } from './event-envelope';

/**
 * Порт outbox (D-47): UoW отдаёт сюда конверты записанных агрегатов одной
 * фиксации — по порядку записи, одной партией. До шины их доставляет relay
 * реализации. Персистентный outbox — реализация потребителя; сбой `put` —
 * исключение фиксации (данные уже записаны, события не считаются
 * опубликованными).
 */
export type Outbox = {
  put(envelopes: readonly EventEnvelope[]): Promise<void>;
};

/**
 * Outbox в процессе по умолчанию: публикует партию в шину сразу — поведение
 * то же, что до D-47.
 */
export class InProcOutbox implements Outbox {
  constructor(private readonly bus: EventBus) {}

  async put(envelopes: readonly EventEnvelope[]): Promise<void> {
    for (const envelope of envelopes) this.bus.publish(envelope);
  }
}
