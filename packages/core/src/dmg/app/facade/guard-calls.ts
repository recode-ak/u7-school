import type { AnyFacadeDef } from '#dmg/domain/contracts/define-facade';
import { facadeDefOf } from './implement-facade';

/**
 * Резолвер, который сообщает об обращении к фасаду вне `calls` (MAN-06 в
 * рантайме): граф не должен врать о связях модулей. По умолчанию — `throw`.
 */
export function guardCalls<R extends object>(
  owner: string,
  calls: readonly AnyFacadeDef[],
  resolve: R,
  onViolation: (message: string) => void = (message) => {
    throw new Error(message);
  },
): R {
  return new Proxy(resolve, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      const facade = facadeDefOf(value);
      if (facade !== undefined && !calls.includes(facade)) {
        onViolation(`${owner}: фасад ${facade.name} не заявлен в calls`);
      }
      return value;
    },
  });
}
