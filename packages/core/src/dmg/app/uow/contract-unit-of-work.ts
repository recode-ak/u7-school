import type { AnyAggregateDef } from '../../domain/aggregate/define-aggregate';
import type { AnyEventDef } from '../../domain/events/define-events';
import type { Caller } from '../../kernel/caller/caller';
import type { AppContext } from '../context';
import { UnitOfWork } from './unit-of-work';

export type OperationContract = {
  readonly caller: Caller<unknown>;
  readonly causationId?: string | undefined;
  readonly emits: readonly AnyEventDef[];
  readonly touches?: readonly AnyAggregateDef[];
};

/**
 * UoW операции со сверкой `emits`/`touches` по Def — в test и development.
 * В production сверки нет: расхождение с контрактом — баг, и ловить его
 * должны тесты, а не отказ пользователю.
 */
export function contractUnitOfWork(
  app: AppContext,
  contract: OperationContract,
): UnitOfWork {
  const { caller, causationId, emits, touches } = contract;
  const strict = app.mode !== 'production';
  return new UnitOfWork({
    bus: app.bus,
    caller,
    ...(causationId === undefined ? {} : { causationId }),
    ...(strict ? { emits } : {}),
    ...(strict && touches !== undefined ? { touches } : {}),
  });
}
