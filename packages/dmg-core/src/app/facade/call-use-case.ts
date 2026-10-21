import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type { CallContext } from '#core/kernel/caller/call-context';
import type { Identified } from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { Result } from '#core/kernel/result/result';
import type { UseCaseHandler } from '../use-case/use-case-from-def';

/**
 * Модуль-владелец UC так, как его видит фасад: Def и реализации по Def
 * (`ModuleFromDef` подходит как есть). Субъект стёрт до `Identified`, как в
 * `CallContext`: `handle` — метод, и реализация с субъектом приложения
 * сюда подходит.
 */
export type UseCaseOwner<M extends AnyModuleDef> = {
  readonly def: M;
  useCase<D extends AnyUseCaseDef>(
    def: D,
  ): UseCaseHandler<D, Identified> | undefined;
};

/**
 * Вызов UC своего модуля из фасада (D-42, API-04): вызывающий и след — из
 * контекста вызова потребителя (`SystemCaller` его операции). Операция-
 * потребитель вызывает только UC из своих `calls` (MAN-05) — иначе
 * `UNAUTHORIZED`, UC не вызывается (мост до типизированного `call`, D-43).
 * Отказы UC — его ответ как есть. UC другого модуля — ошибка компиляции;
 * UC, которого нет среди реализаций владельца, — исключение (ошибка
 * сборки приложения).
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
  if (!call.calls.includes(def)) {
    return Promise.resolve(
      CoreErrors.UNAUTHORIZED.err({
        callerKind: call.caller.kind,
        from: call.caller.from.name,
      }),
    );
  }
  return uc.handle(input, call.caller, call.trace);
}
