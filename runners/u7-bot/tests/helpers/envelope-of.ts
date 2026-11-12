import type { AnyEventDef, EventOf } from 'dmg-core';
import type { EnvelopeOf, EventEnvelope } from 'dmg-core/app';

/** Поля конверта, которые тест может переопределить (имя и payload берутся из Def). */
export type EnvelopeOverrides = Partial<
  Omit<EventEnvelope, 'name' | 'payload'>
>;

/**
 * Конверт события DMG по Def — как его доставляет шина подписчикам.
 * `occurredAt` — число (`Timestamp`, миллисекунды Unix).
 */
export function envelopeOf<D extends AnyEventDef>(
  def: D,
  payload: EventOf<D>['payload'],
  overrides: EnvelopeOverrides = {},
): EnvelopeOf<D> {
  return {
    name: def.name,
    payload,
    eventId: 'event-1',
    occurredAt: Date.parse('2026-01-01T00:00:00.000Z'),
    aggregateId: 'aggregate-1',
    cause: { kind: 'request', requestId: 'request-1' },
    correlationId: 'correlation-1',
    ...overrides,
  } as EnvelopeOf<D>;
}
