import type { AnyModuleDef } from '#core/domain/contracts/module-def';
import type { Identified } from '#core/kernel/caller/caller';
import type { ModuleDeps } from '../context';
import type { AnyModuleFromDef } from '../module/module-from-def';

/**
 * Фабрика модуля приложения (D-50): паспорт модуля и сборка по резолверу
 * платформы. `def` нужен до сборки — по `dependsOn` `ApiApp` решает порядок
 * и раздаёт фасады; `create` замыкает репозитории приложения и расширяет
 * ими `ModuleDeps`. Внешний модуль (D-37) — такая же фабрика.
 */
export type ModuleFactory<U extends Identified> = {
  readonly def: AnyModuleDef;
  readonly create: (deps: ModuleDeps) => AnyModuleFromDef<U>;
};
