// DMG-модуль внешнего контракта пользователей — адаптеры над legacy-фасадом.
import type { UserFacade } from '@u7-scl/domain/user/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { GetTelegramAddressesUc } from './user/uc/get-telegram-addresses.uc';

/** Что адаптеры над legacy-фасадом берут у legacy-фасада пользователей. */
export type UserLegacy = Pick<UserFacade, 'getUserByUuid'>;

/** Резолвер DMG-модуля пользователей: платформа + legacy-фасад. */
export type UserModuleDeps = ModuleDeps & { readonly legacy: UserLegacy };

/** Карта «Def → класс» внешнего модуля пользователей (API-05); ER и Job нет. */
export const userModuleMap = {
  useCases: {
    getTelegramAddresses: GetTelegramAddressesUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof UserModuleDef, UserModuleDeps, Identified>;

/**
 * DMG-модуль пользователей — владелец UC внешнего контракта; фасад для
 * других модулей — `new ModuleFacade(createUserModule(deps))` (D-43).
 */
export function createUserModule(deps: UserModuleDeps) {
  return new ModuleFromDef<typeof UserModuleDef, UserModuleDeps, Identified>(
    UserModuleDef,
    userModuleMap,
    deps,
  );
}
