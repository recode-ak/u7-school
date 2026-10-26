import type * as v from 'valibot';
import type { Def } from './def';

/** Тексты любого Def: имя, метка и описание (MAN-01). */
export type DefTexts<N extends string = string> = {
  readonly name: N;
  readonly label: string;
  readonly description: string;
};

/** Именованные схемы Def — для проверок MAN-02/03 и JSON Schema. */
export type DefSchemas = readonly (readonly [name: string, v.GenericSchema])[];

/** Описание Def для проверок манифеста: тексты и схемы, без заголовка. */
export type DefDescription = {
  readonly label: string;
  readonly description: string;
  readonly schemas: DefSchemas;
};

/** Сериализуемая форма Def — основа графа и хеша (D-27). */
export type NormalizedForm = { readonly dmg: string };

/**
 * Любой Def вида — для `Any*Def`: публичные члены базы со своим
 * дискриминатором и формой `normalize()` вида.
 */
export type DefOf<D extends string, F extends NormalizedForm> = Omit<
  Def,
  'dmg' | 'normalize'
> & {
  readonly dmg: D;
  normalize(): F;
};
