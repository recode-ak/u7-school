import type { Command } from '#core/domain/contracts/command';
import type { Facade, SystemCallable } from '#core/domain/contracts/facade';
import type { AnyModuleDef } from '#core/domain/contracts/module-def';
import {
  type AnyUseCaseDef,
  type InputOf,
  type OutputOf,
  UseCaseDef,
  type UseCaseErrorOf,
} from '#core/domain/contracts/use-case-def';
import type { Caller, SystemCaller } from '#core/kernel/caller/caller';
import type { Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';

/**
 * Модуль так, как его видит фасад: Def и вход команд (`ModuleFromDef`
 * подходит как есть). Субъект стёрт до `Identified`: `dispatch` — метод, и
 * модуль с субъектом приложения сюда подходит.
 */
export type FacadeModule<M extends AnyModuleDef> = {
  readonly def: M;
  dispatch<D extends M['useCases'][number]>(
    command: Command<D>,
    caller: Caller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * In-proc фасад модуля (D-43): команда модулю (`ModuleFromDef.dispatch`,
 * D-49), `handle` по Def — типизированный сахар поверх; доменных решений
 * нет. Отказы UC (`UNAUTHORIZED` без `'system'` в `callers`, Policy, ошибки
 * Def) — ответ модуля как есть. Наследник — только ради удобных методов
 * поверх `handle` фасада.
 */
export class ModuleFacade<M extends AnyModuleDef> implements Facade<M> {
  constructor(protected readonly module: FacadeModule<M>) {}

  get def(): M {
    return this.module.def;
  }

  /**
   * UC из Def модуля — выбор фасада в `ModuleFacades`; полноту реализаций
   * по Def проверяет карта модуля (`ModuleMap`).
   */
  serves(def: AnyUseCaseDef): boolean {
    return this.def.useCases.includes(def);
  }

  handle<D extends AnyUseCaseDef>(
    def: D extends SystemCallable<M> ? D : never,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.module.dispatch(
      UseCaseDef.commandOf(def, input),
      caller,
      trace,
    );
  }
}
