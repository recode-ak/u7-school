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
   * Legacy-событие не прошло схему Def или содержит невалидную дату.
   * Вызывается ровно один раз на событие и маршрут, сколько бы ни было
   * подписчиков. По умолчанию — `console.warn`: проверка идёт в
   * async-обработчике legacy-шины, а `InProcEventBus` исключения
   * обработчиков глотает, так что `throw` не дошёл бы до вызывающего.
   * В production приложение передаёт `logger.warn` (ERR-07).
   */
  readonly onInvalid?: (message: string) => void;
};

type Handler = (envelope: EventEnvelope) => Promise<void>;

const warnInvalid = (message: string): void => {
  console.warn('[legacyEventBus]', message);
};

/**
 * Шина DMG поверх legacy-шины: на время сосуществования события DMG видят
 * и legacy-подписчики (в старой форме). Конверт DMG передаётся подписчикам
 * DMG через WeakMap по тому же объекту — legacy InProc-шина отдаёт
 * обработчикам ссылку, переданную в `publish`. События legacy-кода
 * приходят подписчикам DMG только по карте `inbound`: на каждый маршрут
 * мост подписывается на legacy-шину один раз при создании, строит конверт
 * (payload проверяет схема Def) и раздаёт его подписчикам Def.
 */
export function legacyEventBus(
  legacy: LegacyBus,
  options: LegacyEventBusOptions = {},
): EventBus {
  const envelopes = new WeakMap<LegacyEvent, EventEnvelope>();
  const onInvalid = options.onInvalid ?? warnInvalid;
  /** Подписчики DMG входящих событий по имени Def. */
  const inboundHandlers = new Map<string, Set<Handler>>();

  for (const route of options.inbound ?? []) {
    legacy.subscribe(route.legacy, async (event) => {
      if (envelopes.has(event)) return;
      const handlers = inboundHandlers.get(route.def.name);
      if (handlers === undefined || handlers.size === 0) return;
      const envelope = fromLegacy(route, event, onInvalid);
      if (envelope === undefined) return;
      await deliver([...handlers], envelope);
    });
  }

  return {
    publish(envelope) {
      const event = toLegacy(envelope);
      envelopes.set(event, envelope);
      legacy.publish(event);
    },
    subscribe(def, handler) {
      const off = legacy.subscribe(def.name, async (event) => {
        const envelope = envelopes.get(event);
        if (envelope !== undefined && isOf(def, envelope)) {
          await handler(envelope);
        }
      });
      const inboundHandler: Handler = async (envelope) => {
        if (isOf(def, envelope)) await handler(envelope);
      };
      const handlers = inboundHandlers.get(def.name) ?? new Set<Handler>();
      handlers.add(inboundHandler);
      inboundHandlers.set(def.name, handlers);
      return () => {
        off();
        handlers.delete(inboundHandler);
      };
    },
  };
}

/**
 * Раздать конверт всем подписчикам; сбой одного не мешает остальным.
 * Ошибки пробрасываются legacy-шине, она их логирует (как и для
 * собственных обработчиков).
 */
async function deliver(
  handlers: readonly Handler[],
  envelope: EventEnvelope,
): Promise<void> {
  const results = await Promise.allSettled(handlers.map((h) => h(envelope)));
  const errors = results.flatMap((r) =>
    r.status === 'rejected' ? [r.reason] : [],
  );
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      errors
        .map((e) => (e instanceof Error ? e.message : String(e)))
        .join('; '),
    );
  }
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

/**
 * Конверт DMG из legacy-события; `undefined` — payload не прошёл схему
 * или `occurredAt` не разбирается как дата.
 */
function fromLegacy(
  route: LegacyInbound,
  event: LegacyEvent,
  onInvalid: (message: string) => void,
): EventEnvelope | undefined {
  const occurredAt = Date.parse(event.occurredAt);
  if (Number.isNaN(occurredAt)) {
    onInvalid(
      `legacy-событие ${event.eventName} (${event.eventId}): невалидная дата occurredAt «${event.occurredAt}»`,
    );
    return undefined;
  }
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
    occurredAt,
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
