import type { AnyFacadeDef } from '../../domain/contracts/define-facade';
import { facadeDefOf } from './implement-facade';

/**
 * Резолвер, который бросает при обращении к фасаду вне `calls` (MAN-06 в
 * рантайме). Включается вне production: граф не врёт о связях модулей.
 */
export function guardCalls<R extends object>(
  owner: string,
  calls: readonly AnyFacadeDef[],
  resolve: R,
): R {
  return new Proxy(resolve, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      const facade = facadeDefOf(value);
      if (facade !== undefined && !calls.includes(facade)) {
        throw new Error(`${owner}: фасад ${facade.name} не заявлен в calls`);
      }
      return value;
    },
  });
}
