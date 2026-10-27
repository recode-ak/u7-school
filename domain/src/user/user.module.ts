import { ModuleDef } from 'dmg-core';
import { GetTelegramAddressesUcDef } from './user/uc/get-telegram-addresses.uc';
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
  useCases: [GetTelegramAddressesUcDef],
  reactions: [],
  jobs: [],
});
