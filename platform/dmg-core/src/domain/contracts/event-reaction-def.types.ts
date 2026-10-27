import type { DefTexts } from '#core/kernel/def/def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventDef, EventOf } from '../events/event-def';
import type { EventReactionDef } from './event-reaction-def';
import type { OperationSpec } from './operation-def.types';

/** Контракт ER: подписка на события, что трогает и вызывает, что публикует. */
export type EventReactionSpec = OperationSpec & {
  readonly on: readonly [AnyEventDef, ...AnyEventDef[]];
  /** Агрегаты, которые реакция меняет. */
  readonly touches?: readonly AnyAggregateDef[];
  readonly emits?: readonly AnyEventDef[];
};

/** Любой Def ER — структурный тип публичных членов (как `AnyUseCaseDef`). */
export type AnyEventReactionDef = {
  readonly [K in keyof EventReactionDef]: EventReactionDef[K];
};

/** Union событий, на которые подписана реакция. */
export type ReactionEventOf<D extends AnyEventReactionDef> = EventOf<
  D['on'][number]
>;

/** Сериализуемая форма ER. */
export type NormalizedEventReaction = DefTexts & {
  readonly dmg: 'eventReaction';
  readonly on: readonly string[];
  readonly touches: readonly string[];
  /** Имена UC других модулей, которые реакция вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};
