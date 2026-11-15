import { describe, expect, test } from 'bun:test';
import { SensitiveMask } from 'dmg-core';
import { GetTelegramAddressesUcDef } from './uc/get-telegram-addresses.uc';
import { ListUsersUcDef } from './uc/list-users.uc';
import { RegisterGuestUcDef } from './uc/register-guest.uc';
import { UserErrors } from './user.errors';
import { UserState } from './user.state';

// Персональные данные в логе операций (D-86): пометка `F.sensitive` по аудиту F-111.
const mask = new SensitiveMask();

describe('user: места с персональными данными помечены F.sensitive', () => {
  test.each([
    { place: 'state: name', schema: UserState, path: 'name' },
    { place: 'state: telegramId', schema: UserState, path: 'telegramId' },
    { place: 'state: nick', schema: UserState, path: 'nick' },
    {
      place: 'registerGuest: вход telegramId',
      schema: RegisterGuestUcDef.input,
      path: 'telegramId',
    },
    {
      place: 'registerGuest: вход name',
      schema: RegisterGuestUcDef.input,
      path: 'name',
    },
    {
      place: 'registerGuest: вход nick',
      schema: RegisterGuestUcDef.input,
      path: 'nick',
    },
    {
      place: 'listUsers: вход name',
      schema: ListUsersUcDef.input,
      path: 'name',
    },
    {
      place: 'getTelegramAddresses: выход addresses[].telegramId',
      schema: GetTelegramAddressesUcDef.output,
      path: 'addresses.telegramId',
    },
    {
      place: 'ошибка TELEGRAM_ID_TAKEN: payload telegramId',
      schema: UserErrors.TELEGRAM_ID_TAKEN.payload,
      path: 'telegramId',
    },
  ])('$place', ({ schema, path }) => {
    expect(mask.isSensitive(schema, path)).toBe(true);
  });

  test('ошибка NOT_FOUND: payload скрывается целиком (ветка telegramId union)', () => {
    expect(mask.containsSensitive(UserErrors.NOT_FOUND.payload)).toBe(true);
  });
});
