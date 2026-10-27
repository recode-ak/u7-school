import { ModuleDef } from './module-def';
import type { ModuleSpec } from './module-def.types';

export { ModuleDef } from './module-def';
export type { AnyModuleDef, ModuleSpec } from './module-def.types';

/**
 * Паспорт модуля — обёртка над `ModuleDef.define` на время перевода
 * потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineModule<const S extends ModuleSpec>(
  spec: S,
): ModuleDef<S> {
  return ModuleDef.define(spec);
}
