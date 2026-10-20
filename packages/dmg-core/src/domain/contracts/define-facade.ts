import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/define-errors';
import type { Result } from '#core/kernel/result/result';

/**
 * Метод фасада. Сигнатура (`~args`, `~returns`) живёт только в типе —
 * в рантайме этих полей нет, как `~types` у схем valibot.
 */
export type FacadeMethodDef<
  A extends readonly unknown[],
  T,
  E extends readonly AnyErrorDef[],
> = {
  readonly dmg: 'facadeMethod';
  readonly label: string;
  readonly description: string;
  readonly errors: E;
  readonly '~args'?: A;
  readonly '~returns'?: T;
};

export type AnyFacadeMethodDef = FacadeMethodDef<
  readonly unknown[],
  unknown,
  readonly AnyErrorDef[]
>;

type MethodSpec<E extends readonly AnyErrorDef[]> = {
  readonly label: string;
  readonly description: string;
  readonly errors: E;
};

/**
 * Метод фасада с аргументами `A` и значением `T` в `Ok`:
 * `method<[taskId: string], ReadonlyAr<TaskAr>>()({ label, description, errors })`.
 * Двойной вызов — чтобы задать `A`/`T` явно, а ошибки вывести.
 */
export function method<A extends readonly unknown[], T>() {
  return <const E extends readonly AnyErrorDef[]>(
    spec: MethodSpec<E>,
  ): FacadeMethodDef<A, T, E> => ({ ...spec, dmg: 'facadeMethod' });
}

export type FacadeSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly methods: { readonly [name: string]: AnyFacadeMethodDef };
};

export type FacadeDef<S extends FacadeSpec> = S & { readonly dmg: 'facade' };

export type AnyFacadeDef = FacadeDef<FacadeSpec>;

/** Runtime-API модуля по контракту: каждый метод возвращает `Result`. */
export type FacadeApi<D extends AnyFacadeDef> = {
  readonly [K in keyof D['methods']]: D['methods'][K] extends FacadeMethodDef<
    infer A,
    infer T,
    infer E
  >
    ? (...args: A) => Promise<Result<T, ErrorOf<E[number]>>>
    : never;
};

/** Контракт runtime-API модуля для других модулей. */
export function defineFacade<const S extends FacadeSpec>(
  spec: S,
): FacadeDef<S> {
  return { ...spec, dmg: 'facade' };
}
