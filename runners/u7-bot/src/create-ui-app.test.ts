import { describe, expect, mock, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app';
import { userSubject } from '@u7-scl/domain/user/testing';
import { GuestCaller, UserCaller } from 'dmg-core';
import { createUiApp, type UiAppSource } from './create-ui-app';

const BOT_ADMIN_UUID = '99999999-9999-4999-8999-999999999999';
const MENTOR_UUID = '55555555-5555-4555-8555-555555555555';

const admin = userSubject({
  uuid: BOT_ADMIN_UUID,
  name: 'Admin',
  telegramId: 999,
  roles: ['ADMIN'],
});
/**
 * Приложение на моках: `callers.resolveByTelegramId` (555 — ментор, прочие —
 * гость, или исключение при `lookupError`), `callers.resolve` знает только
 * админа бота. Разбор `getUserByTelegramId` от `SystemCaller` проверяет тест
 * резолвера приложения.
 */
function makeSource(
  opts: { lookupError?: boolean; unresolvable?: string[] } = {},
) {
  const resolveByTelegramId = mock(async (telegramId: number) => {
    if (opts.lookupError) throw new Error('CORE_INTERNAL');
    return telegramId === 555
      ? new UserCaller(
          userSubject({
            uuid: MENTOR_UUID,
            name: 'Ментор',
            telegramId: 555,
            roles: ['MENTOR'],
          }),
        )
      : new GuestCaller();
  });
  const resolve = mock(async (uuid: string | undefined) => ({
    subject: () =>
      opts.unresolvable?.includes(uuid ?? '')
        ? undefined
        : uuid === BOT_ADMIN_UUID
          ? admin
          : undefined,
  }));
  const source = {
    apiApp: { dispatch: mock(async () => undefined) } as any,
    eventBus: {} as any,
    school: TEST_SCHOOL,
    callers: { resolve, resolveByTelegramId } as any,
  } satisfies UiAppSource;
  return { source, resolve, resolveByTelegramId };
}

describe('createUiApp — регистрация SchoolController', () => {
  test('собирает UiAppBundle с schoolController и school в resolve', async () => {
    const { source } = makeSource();
    const uiBundle = await createUiApp(source, {
      botAdminUuid: BOT_ADMIN_UUID,
    });

    expect(uiBundle.schoolController).toBeDefined();
    expect(uiBundle.schoolController.name).toBe('school');
    expect(uiBundle.resolve.school).toEqual(TEST_SCHOOL);
    expect(uiBundle.resolve.callers).toBe(source.callers);
  });

  test('resolve без userFacade и botAdminUser: админ бота — botAdminUuid', async () => {
    const { source } = makeSource();
    const { resolve } = await createUiApp(source, {
      botAdminUuid: BOT_ADMIN_UUID,
    });

    expect(resolve.botAdminUuid).toBe(BOT_ADMIN_UUID);
    expect('userFacade' in resolve).toBe(false);
    expect('botAdminUser' in resolve).toBe(false);
  });

  test('UserController в сборке нет', async () => {
    const { source } = makeSource();
    const bundle = await createUiApp(source, { botAdminUuid: BOT_ADMIN_UUID });

    expect('userController' in bundle).toBe(false);
  });
});

describe('createUiApp — админ бота', () => {
  test('нет субъекта у BOT_ADMIN_UUID → «BOT_ADMIN_UUID не найден»', async () => {
    const { source } = makeSource({ unresolvable: [BOT_ADMIN_UUID] });

    await expect(
      createUiApp(source, { botAdminUuid: BOT_ADMIN_UUID }),
    ).rejects.toThrow(
      `BOT_ADMIN_UUID не найден: пользователь ${BOT_ADMIN_UUID} не существует`,
    );
  });
});

describe('createUiApp — actorResolver', () => {
  test('известный telegramId → UserCaller над UserAr (isMentor) из callers.resolveByTelegramId', async () => {
    const { source, resolveByTelegramId } = makeSource();
    const { resolve: uiResolve } = await createUiApp(source, {
      botAdminUuid: BOT_ADMIN_UUID,
    });

    const actor = await uiResolve.actorResolver(555);

    expect(actor).toBeInstanceOf(UserCaller);
    expect(actor.user.isMentor()).toBe(true);
    expect(actor.user.uuid).toBe(MENTOR_UUID);
    expect(resolveByTelegramId.mock.calls[0]?.[0]).toBe(555);
  });

  test('незнакомый telegramId (гость) → Error «Пользователь с telegramId … не найден»', async () => {
    const { source } = makeSource();
    const { resolve } = await createUiApp(source, {
      botAdminUuid: BOT_ADMIN_UUID,
    });

    await expect(resolve.actorResolver(404)).rejects.toThrow(
      'Пользователь с telegramId 404 не найден',
    );
  });

  test('прочий отказ резолвера → исключение', async () => {
    const { source } = makeSource({ lookupError: true });
    const { resolve } = await createUiApp(source, {
      botAdminUuid: BOT_ADMIN_UUID,
    });

    await expect(resolve.actorResolver(555)).rejects.toThrow();
  });
});
