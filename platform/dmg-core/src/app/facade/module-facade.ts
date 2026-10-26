import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type { Facade, SystemCallable } from '#core/domain/contracts/facade';
import type { Caller, SystemCaller } from '#core/kernel/caller/caller';
import type { Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';

/**
 * Модуль так, как его видит фасад: Def и вход в его UC (`ModuleFromDef`
 * подходит как есть). Субъект стёрт до `Identified`: `handle` — метод, и
 * модуль с субъектом приложения сюда подходит.
 */
export type FacadeModule<M extends AnyModuleDef> = {
  readonly def: M;
  serves(def: AnyUseCaseDef): boolean;
  handle<D extends M['useCases'][number]>(
    def: D,
    input: unknown,
    caller: Caller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * In-proc фасад модуля (D-43): обёртка над `ModuleFromDef.handle`, доменных
 * решений нет. Отказы UC (`UNAUTHORIZED` без `'system'` в `callers`, Policy,
 * ошибки Def) — ответ модуля как есть. Наследник — только ради удобных
 * методов поверх `handle`.
 */
export class ModuleFacade<M extends AnyModuleDef> implements Facade<M> {
  constructor(protected readonly module: FacadeModule<M>) {}

  get def(): M {
    return this.module.def;
  }

  /** Реализован ли UC в модуле — выбор фасада в `ModuleFacades`. */
  serves(def: AnyUseCaseDef): boolean {
    return this.module.serves(def);
  }

  handle<D extends AnyUseCaseDef>(
    def: D extends SystemCallable<M> ? D : never,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.module.handle(def, input, caller, trace);
  }
}
