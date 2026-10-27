import { EventReactionDef } from './event-reaction-def';
import type { EventReactionSpec } from './event-reaction-def.types';
import type { SystemCalls } from './use-case-def.types';

export { EventReactionDef } from './event-reaction-def';
export type {
  AnyEventReactionDef,
  EventReactionSpec,
  ReactionEventOf,
} from './event-reaction-def.types';

/**
 * Контракт ER — обёртка над `EventReactionDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineEventReaction<const S extends EventReactionSpec>(
  spec: S & SystemCalls<S>,
): EventReactionDef<S> {
  return EventReactionDef.define<S>(spec);
}
