import { ModuleDef } from 'dmg-core';
import { AddRoleToUserUcDef } from './user/uc/add-role-to-user.uc';
import { GetTelegramAddressesUcDef } from './user/uc/get-telegram-addresses.uc';
import { GetUserUcDef } from './user/uc/get-user.uc';
import { GetUserByTelegramIdUcDef } from './user/uc/get-user-by-telegram-id.uc';
import { GetUsersByIdsUcDef } from './user/uc/get-users-by-ids.uc';
import { ListUsersUcDef } from './user/uc/list-users.uc';
import { RegisterGuestUcDef } from './user/uc/register-guest.uc';
import { RemoveRoleFromUserUcDef } from './user/uc/remove-role-from-user.uc';
import { UserArDef } from './user/user.ar';

/**
 * Внешний модуль пользователей (D-37): реализован legacy-кодом, здесь только
 * контракт для `dependsOn`. При миграции `external` снимается.
 */
export const UserModuleDef = ModuleDef.define({
  name: 'user',
  label: 'Пользователи',
  description: 'Учётные записи пользователей школы и их роли.',
  external: true,
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [
    AddRoleToUserUcDef,
    GetTelegramAddressesUcDef,
    GetUserUcDef,
    GetUserByTelegramIdUcDef,
    GetUsersByIdsUcDef,
    ListUsersUcDef,
    RegisterGuestUcDef,
    RemoveRoleFromUserUcDef,
  ],
  reactions: [],
  jobs: [],
});
