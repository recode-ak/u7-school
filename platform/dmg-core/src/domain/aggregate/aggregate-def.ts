import { Def, type DefSchemas } from '#core/kernel/def/def';
import { withEntityDefaults } from '#core/kernel/fields/fields';
import { toJsonSchema } from '#core/kernel/schema/json-schema';
import type {
  AggregateSpec,
  AnyAggregateDef,
  LifecycleField,
  NormalizedAggregate,
  NormalizedTransition,
  RejectsComplete,
  StateSchema,
} from './aggregate-def.types';

export type {
  AggregateSpec,
  AnyAggregateDef,
  EntityBase,
  NormalizedAggregate,
  NormalizedTransition,
  RejectErrorDef,
  StateSchema,
  StatusOf,
  Transition,
} from './aggregate-def.types';

/**
 * Манифест агрегата: схема entity, статусы и переходы (если в состоянии есть
 * `status`, статусы обязаны покрыть все его значения, а отказы перехода — все
 * статусы вне `from`), группы событий и ошибок. `state` читает запись без
 * `updatedAt` как `updatedAt = createdAt` (`withEntityDefaults`).
 */
export class AggregateDef<
  const A extends AggregateSpec = AggregateSpec,
> extends Def<A['name']> {
  readonly dmg = 'aggregate';
  readonly state: A['state'];
  readonly events: A['events'];
  readonly errors: A['errors'];
  readonly statuses: LifecycleField<A, 'statuses'>;
  readonly transitions: LifecycleField<A, 'transitions'>;

  constructor(spec: A) {
    super(spec);
    this.state = withEntityDefaults<A['state']>(spec.state);
    this.events = spec.events;
    this.errors = spec.errors;
    // Поля жизненного цикла есть ровно тогда, когда их объявляет спека;
    // `LifecycleField` — тот же выбор на уровне типов.
    this.statuses = (
      'statuses' in spec ? spec.statuses : undefined
    ) as LifecycleField<A, 'statuses'>;
    this.transitions = (
      'transitions' in spec ? spec.transitions : undefined
    ) as LifecycleField<A, 'transitions'>;
  }

  static define<const S extends StateSchema, const A extends AggregateSpec<S>>(
    spec: A & AggregateSpec<S> & RejectsComplete<A>,
  ): AggregateDef<A> {
    return new AggregateDef<A>(spec);
  }

  normalize(): NormalizedAggregate {
    // Расширение до общего вида: аннотация без `as` сузилась бы обратно
    // до дженерика по присваиванию.
    const transitions = this.transitions as AnyAggregateDef['transitions'];
    return {
      dmg: this.dmg,
      ...this.texts(),
      state: toJsonSchema(this.state),
      statuses: this.statuses,
      // Отказы переходов — коды ошибок вместо Def.
      transitions:
        transitions &&
        Object.fromEntries(
          Object.entries(transitions).map(
            ([op, t]): [string, NormalizedTransition] => [
              op,
              {
                from: t.from,
                to: t.to,
                rejects: Object.fromEntries(
                  Object.entries(t.rejects).flatMap(([status, e]) =>
                    e === undefined ? [] : [[status, e.code]],
                  ),
                ),
              },
            ],
          ),
        ),
      events: Object.values(this.events).map((e) => e.name),
      errors: Object.values(this.errors).map((e) => e.code),
    };
  }

  override schemas(): DefSchemas {
    return [['state', this.state]];
  }
}
