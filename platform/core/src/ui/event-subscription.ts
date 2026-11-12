import type { AnyEventDef } from 'dmg-core';
import type { EnvelopeOf } from 'dmg-core/app';

/**
 * Подписка UI на событие по его Def.
 */
export interface UiEventSubscription<D extends AnyEventDef = AnyEventDef> {
  readonly def: D;
  handle(envelope: EnvelopeOf<D>): Promise<void>;
}

/**
 * Фабрика типизированной подписки.
 */
export function eventSubscription<D extends AnyEventDef>(
  def: D,
  handle: (envelope: EnvelopeOf<D>) => Promise<void>,
): UiEventSubscription<D> {
  return { def, handle };
}
