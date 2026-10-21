import type { Trace } from '../trace/trace';
import type { SystemCaller } from './caller';

/**
 * Контекст межмодульного вызова (D-42, мост D-43 до `OperationFromDef`):
 * вызывающий — `SystemCaller` операции-потребителя с её исходным человеком,
 * `calls` — UC, которые она объявила, след — тот же. Операция получает его
 * от базы (`callContext`) и передаёт первым аргументом метода фасада;
 * фасад отказывает (`UNAUTHORIZED`), если вызываемого UC нет в `calls`.
 */
export type CallContext = {
  readonly caller: SystemCaller;
  readonly calls: readonly object[];
  readonly trace: Trace;
};
