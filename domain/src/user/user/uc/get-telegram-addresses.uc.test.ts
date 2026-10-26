import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetTelegramAddressesUcDef } from './get-telegram-addresses.uc';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

describe('GetTelegramAddressesUcDef', () => {
  it('query для других модулей над агрегатом пользователя, без ограничений и ошибок', () => {
    expect(normalize(GetTelegramAddressesUcDef)).toMatchObject({
      name: 'getTelegramAddresses',
      type: 'query',
      aggregate: 'user',
      callers: ['system'],
      errors: [],
    });
    expect(GetTelegramAddressesUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid пользователей', () => {
    const { input } = GetTelegramAddressesUcDef;
    expect(v.parse(input, { userIds: [USER] })).toEqual({ userIds: [USER] });
    expect(v.safeParse(input, { userIds: ['x'] }).success).toBe(false);
  });

  it('выход — пары userId/telegramId только для достижимых', () => {
    const { output } = GetTelegramAddressesUcDef;
    const value = { addresses: [{ userId: USER, telegramId: 42 }] };
    expect(v.parse(output, value)).toEqual(value);
    expect(v.parse(output, { addresses: [] })).toEqual({ addresses: [] });
    expect(v.safeParse(output, { addresses: [{ userId: USER }] }).success).toBe(
      false,
    );
  });
});
