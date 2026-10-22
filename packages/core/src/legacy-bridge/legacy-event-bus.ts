import type { AnyEventDef } from 'dmg-core';
import {
  type EnvelopeOf,
  type EventBus,
  type EventEnvelope,
  Trace,
} from 'dmg-core/app';
import * as v from 'valibot';
import type { DomainEvent as LegacyEvent } from '#domain-legacy/events/domain-event';
import type { EventBus as LegacyBus } from '#domain-legacy/events/event-bus';

/**
 * Входящее legacy-событие (D-37): имя в legacy-шине → Def события из
 * контракта внешнего модуля. `payload` переводит данные legacy в payload
 * Def; по умолчанию берётся как есть.
 */
export type LegacyInbound = {
  readonly legacy: string;
  readonly def: AnyEventDef;
  readonly payload?: (event: LegacyEvent) => unknown;
};

export type LegacyEventBusOptions = {
  readonly inbound?: readonly LegacyInbound[];
  /**
   * Legacy-событие не прошло схему Def. По умолчанию — исключение; в
   * production приложение передаёт `logger.warn` (ERR-07).
   */
  readonly onInvalid?: (message: string) => void;
};

/**
 * Шина DMG поверх legacy-шины: на время сосуществования события DMG видят
 * и legacy-подписчики (в старой форме). Конверт DMG передаётся подписчикам
 * DMG через WeakMap по тому же объекту — legacy InProc-шина отдаёт
 * обработчикам ссылку, переданную в `publish`. События legacy-кода
 * приходят подписчикам DMG только по карте `inbound`: конверт строится из
 * legacy-события, payload проверяет схема Def.
 */
export function legacyEventBus(
  legacy: LegacyBus,
  options: LegacyEventBusOptions = {},
): EventBus {
  const envelopes = new WeakMap<LegacyEvent, EventEnvelope>();
  const onInvalid =
    options.onInvalid ??
    ((message: string) => {
      throw new Error(message);
    });
  return {
    publish(envelope) {
      const event = toLegacy(envelope);
      envelopes.set(event, envelope);
      legacy.publish(event);
    },
    subscribe(def, handler) {
      const offs = [
        legacy.subscribe(def.name, async (event) => {
          const envelope = envelopes.get(event);
          if (envelope !== undefined && isOf(def, envelope)) {
            await handler(envelope);
          }
        }),
        ...(options.inbound ?? [])
          .filter((route) => route.def === def)
          .map((route) =>
            legacy.subscribe(route.legacy, async (event) => {
              if (envelopes.has(event)) return;
              const envelope = fromLegacy(route, event, onInvalid);
              if (envelope !== undefined && isOf(def, envelope)) {
                await handler(envelope);
              }
            }),
          ),
      ];
      return () => {
        for (const off of offs) off();
      };
    },
  };
}

/**
 * Имя события — уникальный FQN (D-10), а конверт строится только из
 * `def.make()` или схемы Def, поэтому совпадение имени гарантирует тип payload.
 */
function isOf<D extends AnyEventDef>(
  def: D,
  envelope: EventEnvelope,
): envelope is EnvelopeOf<D> {
  return envelope.name === def.name;
}

/** Конверт DMG из legacy-события; `undefined` — payload не прошёл схему. */
function fromLegacy(
  route: LegacyInbound,
  event: LegacyEvent,
  onInvalid: (message: string) => void,
): EventEnvelope | undefined {
  const raw = route.payload ? route.payload(event) : event.payload;
  const parsed = v.safeParse(route.def.payload, raw);
  if (!parsed.success) {
    onInvalid(
      `legacy-событие ${event.eventName} (${event.eventId}) не прошло схему ${route.def.name}: ${v.summarize(parsed.issues)}`,
    );
    return undefined;
  }
  return {
    name: route.def.name,
    payload: parsed.output,
    eventId: event.eventId,
    occurredAt: Date.parse(event.occurredAt),
    aggregateId: event.aggregateId,
    ...Trace.fromEvent({
      eventId: event.eventId,
      correlationId: event.eventId,
    }).toEnvelope(),
  };
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
