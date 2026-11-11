import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { UserAr } from './user.ar';
import { stored } from './user.fixture';
import { UserRules } from './user.rules';

// Новое правило (Р5): в legacy проверка telegramId жила в UC, без отдельного теста.

const { telegramIdFree } = UserRules.rules;

describe('UserRules.telegramIdFree', () => {
  it('держателя telegramId нет — ok', () => {
    expectOk(telegramIdFree.check({}));
  });

  it('telegramId занят — USER_TELEGRAM_ID_TAKEN с telegramId держателя', () => {
    const holder = UserAr.restore(stored({ telegramId: 555 }));
    const error = expectErr(
      telegramIdFree.check({ holder }),
      'USER_TELEGRAM_ID_TAKEN',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({ telegramId: 555 });
  });
});
