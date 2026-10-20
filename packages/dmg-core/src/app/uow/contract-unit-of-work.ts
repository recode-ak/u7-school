import type { AnyAggregateDef } from '#core/domain/aggregate/define-aggregate';
import type { AnyEventDef } from '#core/domain/events/define-events';
import type { Caller } from '#core/kernel/caller/caller';
import type { AppContext } from '../context';
import type { Trace } from '../trace';
import { UnitOfWork } from './unit-of-work';

export type OperationContract = {
  /** Имя операции — источник записи в логе. */
  readonly source: string;
  readonly caller: Caller<unknown>;
  readonly trace: Trace;
  readonly emits: readonly AnyEventDef[];
  readonly touches?: readonly AnyAggregateDef[];
};

/**
 * UoW операции со сверкой `emits`/`touches` по Def. Расхождение — баг
 * реализации: в test и development — исключение, в production — `warn`
 * в лог, а операция завершается (отказ пользователю из-за описания
 * контракта хуже, чем запись для разбора).
 */
export function contractUnitOfWork(
  app: AppContext,
  contract: OperationContract,
): UnitOfWork {
  const { source, caller, trace, emits, touches } = contract;
  return new UnitOfWork({
    bus: app.bus,
    caller,
    trace,
    emits,
    ...(touches === undefined ? {} : { touches }),
    ...(app.mode === 'production'
      ? { onViolation: (message: string) => app.logger.warn(source, message) }
      : {}),
  });
}
