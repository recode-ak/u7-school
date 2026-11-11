import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const NEW_TG = 9001;
const JOINER_TG = 9002;

/**
 * E2E гост-регистрации через настоящий модуль `user` (без заглушки): бот
 * регистрирует незнакомого отправителя от имени админа мира; вступление в
 * группу школы выдаёт роль SUBSCRIBER (FR-7).
 */
describe('E2E: гост-регистрация и подписка сообщества', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('guest-registration-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
    ]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('/start незнакомого telegramId → создаётся GUEST (имя, ник), welcome-экран', async () => {
    await expect(app.userByTelegramId(NEW_TG)).rejects.toThrow(
      `Нет пользователя фикстуры tg=${NEW_TG}`,
    );

    const response = await transport.handleStart(
      transport.makeBotContext(NEW_TG, {
        from: { first_name: 'Анна', username: 'anna_u7' },
      }),
    );

    expect(response.screen?.text).toContain('Привет');
    const view = (await app.userByTelegramId(NEW_TG)).user.view();
    expect(view.roles).toEqual(['GUEST']);
    expect(view.name).toBe('Анна');
    expect(view.nick).toBe('anna_u7');
  });

  test('повторный /start — без дубля пользователя', async () => {
    const before = (await app.userByTelegramId(NEW_TG)).user.uuid;

    await transport.handleStart(
      transport.makeBotContext(NEW_TG, {
        from: { first_name: 'Анна', username: 'anna_u7' },
      }),
    );

    expect((await app.userByTelegramId(NEW_TG)).user.uuid).toBe(before);
  });

  test('вступление незнакомого в группу школы → GUEST + SUBSCRIBER', async () => {
    await transport.uiApp.handleMessengerEvent({
      kind: 'member_joined',
      chatId: String(TEST_SCHOOL.communityGroup.id),
      user: { id: JOINER_TG, firstName: 'Пётр', username: 'peter' },
    });

    const view = (await app.userByTelegramId(JOINER_TG)).user.view();
    expect(view.name).toBe('Пётр');
    expect(view.roles).toContain('SUBSCRIBER');
  });

  test('выход из группы школы снимает SUBSCRIBER', async () => {
    await transport.uiApp.handleMessengerEvent({
      kind: 'member_left',
      chatId: String(TEST_SCHOOL.communityGroup.id),
      user: { id: JOINER_TG, firstName: 'Пётр' },
    });

    const view = (await app.userByTelegramId(JOINER_TG)).user.view();
    expect(view.roles).not.toContain('SUBSCRIBER');
  });
});
