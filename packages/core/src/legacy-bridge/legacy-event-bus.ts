import type {
  AnyEventDef,
  EnvelopeOf,
  EventBus,
  EventEnvelope,
} from '#dmg/index';
import type { DomainEvent as LegacyEvent } from '#domain-legacy/events/domain-event';
import type { EventBus as LegacyBus } from '#domain-legacy/events/event-bus';

/**
 * Шина DMG поверх legacy-шины: на время сосуществования события DMG видят
 * и legacy-подписчики (в старой форме). Конверт DMG передаётся подписчикам
 * DMG через WeakMap по тому же объекту — legacy InProc-шина отдаёт
 * обработчикам ссылку, переданную в `publish`. События legacy-кода
 * подписчикам DMG не приходят: у них нет конверта.
 */
export function legacyEventBus(legacy: LegacyBus): EventBus {
  const envelopes = new WeakMap<LegacyEvent, EventEnvelope>();
  return {
    publish(envelope) {
      const event = toLegacy(envelope);
      envelopes.set(event, envelope);
      legacy.publish(event);
    },
    subscribe(def, handler) {
      return legacy.subscribe(def.name, async (event) => {
        const envelope = envelopes.get(event);
        if (envelope !== undefined && isOf(def, envelope)) {
          await handler(envelope);
        }
      });
    },
  };
}

/**
 * Имя события — уникальный FQN (D-10), а конверт строится только из
 * `def.make()`, поэтому совпадение имени гарантирует тип payload.
 */
function isOf<D extends AnyEventDef>(
  def: D,
  envelope: EventEnvelope,
): envelope is EnvelopeOf<D> {
  return envelope.name === def.name;
}

function toLegacy(envelope: EventEnvelope): LegacyEvent {
  const { payload } = envelope;
  return {
    eventId: envelope.eventId,
    eventName: envelope.name,
    occurredAt: new Date(envelope.occurredAt).toISOString(),
    aggregateName: envelope.name.slice(0, envelope.name.lastIndexOf('.')),
    aggregateId: envelope.aggregateId,
    payload: isRecord(payload) ? payload : { value: payload },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
