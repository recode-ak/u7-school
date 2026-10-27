import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventDef } from '../events/event-def';
import type {
  EventReactionSpec,
  NormalizedEventReaction,
} from './event-reaction-def.types';
import { OperationDef } from './operation-def';
import type { Declared } from './operation-def.types';
import type { SystemCalls } from './use-case-def.types';

export type {
  AnyEventReactionDef,
  EventReactionSpec,
  NormalizedEventReaction,
  ReactionEventOf,
} from './event-reaction-def.types';

/**
 * Контракт ER: события `on`, агрегаты своего модуля `touches`, вызовы
 * `calls` и публикуемые события. Необъявленные списки — пустые кортежи
 * из конструктора.
 */
export class EventReactionDef<
  const S extends EventReactionSpec = EventReactionSpec,
> extends OperationDef<S['name']> {
  declare readonly calls: Declared<S, 'calls'>;
  readonly dmg = 'eventReaction';
  readonly abbr = 'ER';
  readonly fileKind = 'er';
  readonly on: S['on'];
  readonly touches: Declared<S, 'touches'>;
  readonly emits: Declared<S, 'emits'>;

  constructor(spec: S) {
    super(spec);
    this.on = spec.on;
    this.touches = (spec.touches ?? []) as Declared<S, 'touches'>;
    this.emits = (spec.emits ?? []) as Declared<S, 'emits'>;
  }

  static define<const S extends EventReactionSpec>(
    spec: S & SystemCalls<S>,
  ): EventReactionDef<S> {
    return new EventReactionDef<S>(spec);
  }

  aggregates(): readonly AnyAggregateDef[] {
    return this.touches;
  }

  override subscribedEvents(): readonly AnyEventDef[] {
    return this.on;
  }

  normalize(): NormalizedEventReaction {
    return {
      dmg: this.dmg,
      ...this.texts(),
      on: this.on.map((e) => e.name),
      touches: this.touches.map((a) => a.name),
      calls: this.calls.map((u) => u.name),
      emits: this.emits.map((e) => e.name),
    };
  }
}
