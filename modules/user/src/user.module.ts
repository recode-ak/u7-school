// DMG-модуль пользователей: учётные записи, роли, адреса Telegram.
import { type UserAr, UserModuleDef } from '@u7-scl/domain/user/contract';
import type { ReadonlyAr } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { AddRoleToUserUc } from './user/uc/add-role-to-user.uc';
import { GetTelegramAddressesUc } from './user/uc/get-telegram-addresses.uc';
import { GetUserUc } from './user/uc/get-user.uc';
import { GetUserByTelegramIdUc } from './user/uc/get-user-by-telegram-id.uc';
import { GetUsersByIdsUc } from './user/uc/get-users-by-ids.uc';
import { ListUsersUc } from './user/uc/list-users.uc';
import { RegisterGuestUc } from './user/uc/register-guest.uc';
import { RemoveRoleFromUserUc } from './user/uc/remove-role-from-user.uc';
import type { UserRepo } from './user/user.repo';

/** Резолвер модуля пользователей: платформа и репозиторий пользователей. */
export type UserDeps = ModuleDeps & {
  readonly users: UserRepo;
};

/**
 * Карта «Def → класс» модуля пользователей (API-05): субъект приложения —
 * `ReadonlyAr<UserAr>`: его Policy ролей читает `isAdmin`.
 */
export const userModuleMap = {
  useCases: {
    addRoleToUser: AddRoleToUserUc,
    getTelegramAddresses: GetTelegramAddressesUc,
    getUser: GetUserUc,
    getUserByTelegramId: GetUserByTelegramIdUc,
    getUsersByIds: GetUsersByIdsUc,
    listUsers: ListUsersUc,
    registerGuest: RegisterGuestUc,
    removeRoleFromUser: RemoveRoleFromUserUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof UserModuleDef, UserDeps, ReadonlyAr<UserAr>>;

/**
 * DMG-модуль пользователей — владелец UC контракта; фасад для других
 * модулей — `new ModuleFacade(createUserModule(deps))` (D-43).
 */
export function createUserModule(deps: UserDeps) {
  return new ModuleFromDef<typeof UserModuleDef, UserDeps, ReadonlyAr<UserAr>>(
    UserModuleDef,
    userModuleMap,
    deps,
  );
}
