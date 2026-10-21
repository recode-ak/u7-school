import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type { CallContext } from '#core/kernel/caller/call-context';
import { moduleCaller } from '#core/kernel/caller/caller';
import type { Result } from '#core/kernel/result/result';
import type { UseCaseHandler } from '../use-case/use-case-from-def';

/**
 * Модуль-владелец UC так, как его видит фасад: Def и реализации по Def
 * (`ModuleFromDef` подходит как есть). Субъект стёрт до `unknown`, как в
 * `CallContext`: `handle` — метод, и реализация с субъектом приложения
 * сюда подходит.
 */
export type UseCaseOwner<M extends AnyModuleDef> = {
  readonly def: M;
  useCase<D extends AnyUseCaseDef>(
    def: D,
  ): UseCaseHandler<D, unknown> | undefined;
};

/**
 * Вызов UC своего модуля из фасада (D-42, API-04): вызывающий — `module`
 * (`from` и `origin` — из контекста вызова потребителя), след — тот же.
 * Отказы — ответ UC как есть, в том числе `UNAUTHORIZED`, если `from` не
 * объявил UC в `calls`. UC другого модуля — ошибка компиляции; UC, которого
 * нет среди реализаций владельца, — исключение (ошибка сборки приложения).
 */
export function callUseCase<
  M extends AnyModuleDef,
  D extends M['useCases'][number],
>(
  owner: UseCaseOwner<M>,
  def: D,
  input: InputOf<D>,
  call: CallContext,
): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
  const uc = owner.useCase(def);
  if (uc === undefined) {
    return Promise.reject(
      new Error(`UC ${def.name} не реализован в модуле ${owner.def.name}`),
    );
  }
  return uc.handle(input, moduleCaller(call.from, call.caller), call.trace);
}
