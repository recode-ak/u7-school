import type { SystemCaller } from '#core/kernel/caller/caller';
import type { Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { AnyModuleDef } from './define-module';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  SystemCallableUc,
  UseCaseErrorOf,
} from './define-use-case';

/** UC модуля M, которые может вызвать система: `'system'` в `callers`. */
export type SystemCallable<M extends AnyModuleDef> = SystemCallableUc<
  M['useCases'][number]
>;

/**
 * Фасад модуля M — рантайм-граница для других модулей (D-42, D-43): вход в
 * UC модуля, доступные системе, от `SystemCaller` операции-потребителя.
 * Выход и ошибки — как у UC; `ReadonlyAr` строит вызывающий. Реализация
 * в приложении — `ModuleFacade` (in-proc) или сетевой клиент, в тестах —
 * `StubFacade`; вызывающий код от этого не меняется.
 */
export interface Facade<M extends AnyModuleDef> {
  readonly def: M;
  handle<D extends AnyUseCaseDef>(
    def: D extends SystemCallable<M> ? D : never,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
}
