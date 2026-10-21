import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '../domain/contracts/define-use-case';
import type { CallContext } from '../kernel/caller/call-context';
import { CoreErrors } from '../kernel/errors/core-errors';
import type { Result } from '../kernel/result/result';

/**
 * Фейк метода фасада для тестов модуля-потребителя (D-42, MAN-05): та же
 * сигнатура, что у метода фасада (`call` первым), но вместо вызова UC —
 * ответ теста. Проверку вызова повторяет за `UseCaseFromDef`: у UC нет
 * `module` в `callers` или операции-потребителя нет UC в `call.from.calls`
 * — `UNAUTHORIZED` с тем же payload, ответ теста не вызывается. Так тест
 * потребителя ловит Def, забывший объявить вызываемый UC.
 *
 * Ответ (`T`) — не обязательно выход UC: фасад может отдать и `ReadonlyAr`.
 *
 * @example
 * const facade: CourseModuleFacade = {
 *   getCourseEnrollment: fakeFacadeCall(GetCourseEnrollmentUcDef, () =>
 *     ok({ enrollable: false }),
 *   ),
 * };
 */
export function fakeFacadeCall<
  D extends AnyUseCaseDef,
  A extends readonly unknown[],
  T = OutputOf<D>,
>(
  def: D,
  answer: (
    call: CallContext,
    ...args: A
  ) => Result<T, UseCaseErrorOf<D>> | Promise<Result<T, UseCaseErrorOf<D>>>,
): (call: CallContext, ...args: A) => Promise<Result<T, UseCaseErrorOf<D>>> {
  return async (call, ...args) => {
    if (!def.callers.includes('module')) {
      return CoreErrors.UNAUTHORIZED.err({ callerKind: 'module' });
    }
    if (!call.from.calls?.includes(def)) {
      return CoreErrors.UNAUTHORIZED.err({
        callerKind: 'module',
        from: call.from.name,
      });
    }
    return answer(call, ...args);
  };
}
