import { describe, expect, test } from 'bun:test';
import { BotRequestContext } from '@u7-scl/core/ui';
import {
  GetUserByTelegramIdUcDef,
  RegisterGuestUcDef,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import {
  BOT_ADMIN_UUID,
  userApiMock,
  userErr,
  userView,
} from './core/user-api.test-kit';
import { ensureRegisteredGuest } from './ensure-registered';

describe('ensureRegisteredGuest', () => {
  test('новый пользователь → registerGuest от botAdminUuid (first_name + username)', async () => {
    const api = userApiMock();

    await ensureRegisteredGuest(api, {
      id: 555,
      first_name: 'Анна',
      username: 'anna_u7',
    });

    expect(api.commands()).toEqual([
      GetUserByTelegramIdUcDef.command({ telegramId: 555 }),
      RegisterGuestUcDef.command({
        telegramId: 555,
        name: 'Анна',
        nick: 'anna_u7',
      }),
    ]);
    expect(api.dispatch.mock.calls[0]?.[0]).toBe(UserModuleDef);
    // Поиск — от гостя, регистрация — от админа бота
    expect(api.resolve.mock.calls.map((c) => c[0])).toEqual([
      undefined,
      BOT_ADMIN_UUID,
    ]);
  });

  test('без username ник в команде не передаётся', async () => {
    const api = userApiMock();

    await ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' });

    expect(api.commands()[1]).toEqual(
      RegisterGuestUcDef.command({ telegramId: 555, name: 'Анна' }),
    );
  });

  test('имя из одних пробелов → регистрация с именем по умолчанию «друг»', async () => {
    const api = userApiMock();

    await ensureRegisteredGuest(api, { id: 555, first_name: '   ' });

    expect(api.commands()[1]).toEqual(
      RegisterGuestUcDef.command({ telegramId: 555, name: 'друг' }),
    );
  });

  test('существующий пользователь → регистрация не вызывается', async () => {
    const api = userApiMock({ lookup: userView() });

    await ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' });

    expect(api.commands()).toEqual([
      GetUserByTelegramIdUcDef.command({ telegramId: 555 }),
    ]);
  });

  test('гонка /start: USER_TELEGRAM_ID_TAKEN — тихий успех', async () => {
    const api = userApiMock({
      register: userErr('USER_TELEGRAM_ID_TAKEN'),
    });

    await expect(
      ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' }),
    ).resolves.toBeUndefined();
  });

  test('отказ регистрации ACCESS_DENIED — исключение', async () => {
    const api = userApiMock({
      register: userErr('CORE_ACCESS_DENIED', 'access_denied'),
    });

    await expect(
      ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' }),
    ).rejects.toThrow();
  });

  test('сбой регистрации (прочий Err) — исключение', async () => {
    const api = userApiMock({ register: userErr('CORE_INTERNAL', 'internal') });

    await expect(
      ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' }),
    ).rejects.toThrow();
  });

  test('поиск по telegramId: Err, кроме NOT_FOUND — исключение, регистрации нет', async () => {
    const api = userApiMock({ lookup: userErr('CORE_INTERNAL', 'internal') });

    await expect(
      ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' }),
    ).rejects.toThrow();
    expect(api.commands()).toHaveLength(1);
  });

  test('в контексте апдейта: у каждой команды свой requestId', async () => {
    const api = userApiMock();

    await BotRequestContext.run(42, () =>
      ensureRegisteredGuest(api, { id: 555, first_name: 'Анна' }),
    );

    const ids = api.resolve.mock.calls.map(
      (c) => (c[1] as { clientRequestId?: string }).clientRequestId,
    );
    expect(ids).toEqual(['tg:42#1', 'tg:42#2']);
  });
});
