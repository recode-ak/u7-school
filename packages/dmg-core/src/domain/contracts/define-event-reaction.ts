import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef, EventOf } from '../events/define-events';
import type { AnyUseCaseDef } from './define-use-case';

export type EventReactionSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly on: readonly [AnyEventDef, ...AnyEventDef[]];
  /** Агрегаты, которые реакция меняет. */
  readonly touches?: readonly AnyAggregateDef[];
  /** UC других модулей, которые реакция вызывает через фасады (D-42). */
  readonly calls?: readonly AnyUseCaseDef[];
  readonly emits?: readonly AnyEventDef[];
};

export type EventReactionDef<S extends EventReactionSpec> = S &
  Required<Pick<EventReactionSpec, 'touches' | 'calls' | 'emits'>> & {
    readonly dmg: 'eventReaction';
  };

export type AnyEventReactionDef = EventReactionDef<EventReactionSpec>;

/** Union событий, на которые подписана реакция. */
export type ReactionEventOf<D extends AnyEventReactionDef> = EventOf<
  D['on'][number]
>;

/** Контракт ER: подписка на события, что трогает и вызывает, что публикует. */
export function defineEventReaction<const S extends EventReactionSpec>(
  spec: S,
): EventReactionDef<S> {
  return {
    touches: [],
    calls: [],
    emits: [],
    ...spec,
    dmg: 'eventReaction',
  };
}
