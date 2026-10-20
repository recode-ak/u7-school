import type {
  AnyFacadeDef,
  FacadeApi,
} from '#dmg/domain/contracts/define-facade';

const implemented = new WeakMap<object, AnyFacadeDef>();

/**
 * Реализация фасада по Def: тип API выводится из контракта, а связь
 * «объект → Def» запоминается для проверки `calls` (`guardCalls`).
 */
export function implementFacade<D extends AnyFacadeDef>(
  def: D,
  api: FacadeApi<D>,
): FacadeApi<D> {
  implemented.set(api, def);
  return api;
}

/** Def фасада, если `value` создан `implementFacade`. */
export function facadeDefOf(value: unknown): AnyFacadeDef | undefined {
  return typeof value === 'object' && value !== null
    ? implemented.get(value)
    : undefined;
}
