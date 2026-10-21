import type { Trace } from '../trace/trace';
import type { Caller, CallingOperation } from './caller';

/**
 * Контекст межмодульного вызова (D-42): кто вызвал фасад (`from` — Def
 * операции, объявившей вызываемый UC в `calls`), от чьего имени (`caller`)
 * и в какой цепочке (`trace`). Операция получает его от базы
 * (`callContext`) и передаёт первым аргументом метода фасада; фасад
 * строит из него вызывающего `module`.
 *
 * Тип пользователя стёрт до `unknown`, как в конверте события: его
 * замыкает приложение, а не домен, где объявлен тип фасада.
 */
export type CallContext = {
  readonly from: CallingOperation;
  readonly caller: Caller<unknown>;
  readonly trace: Trace;
};
