import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { RegisterGuestUc } from './register-guest.uc';
import {
  asAdmin,
  asMember,
  makeEnv,
  REQ,
  T1,
  userState,
} from './user-uc.fixture';

// Перенос `api/user/register-guest-uc.test.ts` (4). Вместо «возвращает
// существующего» — USER_TELEGRAM_ID_TAKEN.

let env: ReturnType<typeof makeEnv>;
const uc = () => new RegisterGuestUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
});

describe('RegisterGuestUc', () => {
  it('админ регистрирует нового гостя: роль GUEST, ник, время часов, запись сохранена', async () => {
    const res = await uc().handle(
      { telegramId: 777, name: 'Гость', nick: 'guest_nick' },
      asAdmin,
      REQ,
    );

    const view = expectOk(res);
    expect(view).toMatchObject({
      name: 'Гость',
      telegramId: 777,
      nick: 'guest_nick',
      roles: ['GUEST'],
      createdAt: T1,
      updatedAt: T1,
    });
    expect(env.users.saved).toHaveLength(1);
    expect(env.stored(view.uuid)).toMatchObject({
      telegramId: 777,
      roles: ['GUEST'],
    });
  });

  it('пустой ник не записывается', async () => {
    const view = expectOk(
      await uc().handle(
        { telegramId: 778, name: 'Без ника', nick: '' },
        asAdmin,
        REQ,
      ),
    );

    expect('nick' in view).toBe(false);
    expect('nick' in env.stored(view.uuid)).toBe(false);
  });

  it('не-админ — ACCESS_DENIED (canRegisterGuest), ничего не записано', async () => {
    const res = await uc().handle(
      { telegramId: 779, name: 'Гость' },
      asMember,
      REQ,
    );

    const error = expectErr(res, 'ACCESS_DENIED');
    expect(error.payload).toMatchObject({ rule: 'canRegisterGuest' });
    expect(env.users.saved).toEqual([]);
  });

  it('telegramId занят — USER_TELEGRAM_ID_TAKEN с telegramId, запись не добавлена', async () => {
    env.seed(userState({ telegramId: 555 }));

    const error = expectErr(
      await uc().handle({ telegramId: 555, name: 'Двойник' }, asAdmin, REQ),
      'USER_TELEGRAM_ID_TAKEN',
    );

    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({ telegramId: 555 });
    expect(env.users.saved).toEqual([]);
  });
});
