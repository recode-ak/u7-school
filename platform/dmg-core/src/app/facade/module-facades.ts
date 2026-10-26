import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type { SystemCaller } from '#core/kernel/caller/caller';
import type { Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';

/**
 * Фасад так, как его видит маршрутизация: `serves` и вход в UC с типом
 * модуля, стёртым до любого Def. `Facade<M>` (`ModuleFacade`, `StubFacade`)
 * подходит как есть: его `handle` пропускает только UC модуля, доступные
 * системе, — выбор по `serves` до вызова.
 */
export type RoutableFacade = {
  serves(def: AnyUseCaseDef): boolean;
  handle<D extends AnyUseCaseDef>(
    def: D,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * Фасады модулей из `dependsOn` — в резолвере модуля (`ModuleDeps`).
 * `call` выбирает фасад по `serves(def)`; операция зовёт его через
 * `OperationFromDef.call`, где тип пропускает только UC из `calls`.
 * Нет фасада для UC — исключение: это ошибка сборки приложения, а не отказ
 * операции (ERR-01).
 */
export class ModuleFacades {
  constructor(private readonly facades: readonly RoutableFacade[] = []) {}

  call<D extends AnyUseCaseDef>(
    def: D,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const facade = this.facades.find((f) => f.serves(def));
    if (facade === undefined) {
      return Promise.reject(
        new Error(
          `Нет фасада модуля для UC ${def.name}: модуль-владелец не передан в facades`,
        ),
      );
    }
    return facade.handle(def, input, caller, trace);
  }
}
