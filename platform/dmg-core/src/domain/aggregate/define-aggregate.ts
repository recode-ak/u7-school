import { AggregateDef } from './aggregate-def';
import type {
  AggregateSpec,
  RejectsComplete,
  StateSchema,
} from './aggregate-def.types';

export { AggregateDef } from './aggregate-def';
export type {
  AggregateSpec,
  AnyAggregateDef,
  EntityBase,
  RejectErrorDef,
  StateSchema,
  StatusOf,
  Transition,
} from './aggregate-def.types';

/**
 * Манифест агрегата — обёртка над `AggregateDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineAggregate<
  const S extends StateSchema,
  const A extends AggregateSpec<S>,
>(spec: A & AggregateSpec<S> & RejectsComplete<A>): AggregateDef<A> {
  return AggregateDef.define<S, A>(spec);
}
