import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import type { MessengerEvent } from '@u7-scl/core/ui';
import { createTestApp, type TestApp } from './test-app';
import {
  createTestBotTransport,
  pressedCode,
  type TestBotTransport,
} from './test-bot-transport';

const TG = 1007;
const GROUP = -1001234567890;

describe('TestBotTransport: события групп через транспорт (F-02)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let events: MessengerEvent[];

  beforeAll(async () => {
    app = await createTestApp('tbt-chat-member');
    transport = createTestBotTransport(app, [
      new AppController('https://t.me/g'),
      new SchoolController(),
    ]);
    // перехват границы uiApp: проверяем, что событие дошло ЧЕРЕЗ обработчик транспорта
    transport.uiApp.handleMessengerEvent = async (event) => {
      events.push(event);
    };
  });

  beforeEach(() => {
    events = [];
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('chatMember: вход в группу — member_joined с данными пользователя', async () => {
    await transport.chatMember({
      chatId: GROUP,
      user: { id: 555, first_name: 'Ира', last_name: 'К', username: 'ira' },
      oldStatus: 'left',
      newStatus: 'member',
    });
    expect(events).toEqual([
      {
        kind: 'member_joined',
        chatId: String(GROUP),
        user: { id: 555, firstName: 'Ира', lastName: 'К', username: 'ira' },
      },
    ]);
  });

  test('chatMember: выход — member_left, бан — kicked: true', async () => {
    await transport.chatMember({
      chatId: GROUP,
      user: { id: 555, first_name: 'Ира' },
      oldStatus: 'member',
      newStatus: 'left',
    });
    await transport.chatMember({
      chatId: GROUP,
      user: { id: 555, first_name: 'Ира' },
      oldStatus: 'member',
      newStatus: 'kicked',
    });
    expect(events.map((e) => e.kind)).toEqual(['member_left', 'member_left']);
    expect(events.map((e) => 'kicked' in e && e.kicked)).toEqual([false, true]);
  });

  test('chatMember: смена member → administrator события не даёт', async () => {
    await transport.chatMember({
      chatId: GROUP,
      user: { id: 555, first_name: 'Ира' },
      oldStatus: 'member',
      newStatus: 'administrator',
    });
    expect(events).toEqual([]);
  });

  test('myChatMember: бота добавили и удалили — bot_membership с byUser', async () => {
    await transport.myChatMember({
      chatId: GROUP,
      from: { id: 1005, first_name: 'Админ' },
      oldStatus: 'left',
      newStatus: 'administrator',
    });
    await transport.myChatMember({
      chatId: GROUP,
      from: { id: 1005, first_name: 'Админ' },
      oldStatus: 'administrator',
      newStatus: 'kicked',
    });
    expect(events).toEqual([
      {
        kind: 'bot_membership',
        chatId: String(GROUP),
        status: 'added',
        byUser: { id: 1005, firstName: 'Админ' },
      },
      {
        kind: 'bot_membership',
        chatId: String(GROUP),
        status: 'removed',
        byUser: { id: 1005, firstName: 'Админ' },
      },
    ]);
  });
});

describe('TestBotTransport: хелперы транспорта (F-03)', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('tbt-helpers');
    transport = createTestBotTransport(app, [
      new AppController('https://t.me/g'),
      new SchoolController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
    transport.dropSession(TG);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  const alerts = () => transport.alerts;

  test('pressWithoutDialog: нажатие до /start — alert «Наберите /start», экранов нет', async () => {
    const response = await transport.pressWithoutDialog(TG, 'school:x:y');
    expect(response).toEqual({});
    expect(alerts()).toEqual(['Наберите /start']);
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('pressUnknownShortId: неизвестный shortId при живом диалоге — alert про рестарт', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    const response = await transport.pressUnknownShortId(TG, 'school:x:y');
    expect(response).toEqual({});
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toContain('кнопка устарела');
  });

  test('doubleTap: второе нажатие той же кнопки — alert «Экран устарел»', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    const code = firstButtonCode(transport);
    const [first, second] = await transport.doubleTap(TG, code);
    expect(first).not.toEqual({});
    expect(second).toEqual({});
    expect(alerts()).toEqual(['Экран устарел — нажмите /start']);
  });

  test('pressConcurrently: два апдейта без await — каждый получает свой ответ, дубль отсеян', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    const code = firstButtonCode(transport);
    const [first, second] = await transport.pressConcurrently(TG, code, 2);
    expect(first).not.toEqual({});
    expect(second).toEqual({});
    expect(alerts()).toEqual(['Экран устарел — нажмите /start']);
  });

  test('sendText: текст без «/» до /start и при диалоге без ввода — подсказки', async () => {
    await transport.sendText(TG, 'привет');
    expect(transport.api.sentMessages.at(-1)?.text).toContain(
      'Сначала наберите /start',
    );
    await transport.handleStart(transport.makeBotContext(TG));
    await transport.sendText(TG, 'привет');
    expect(transport.api.sentMessages.at(-1)?.text).toContain(
      'сообщения не принимаются',
    );
  });

  test('press: нажатие кнопки по фрагменту текста с последнего экрана', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    const text = transport.api.sentMessages
      .find((m) => m.telegramId === TG)
      ?.keyboard?.rows.flat()[0]?.text;
    const response = await transport.press(TG, text ?? '');
    expect(response).not.toEqual({});
  });

  test('press: кнопки нет — «Кнопка «…» не найдена»', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    await expect(transport.press(TG, 'нет-такой-кнопки')).rejects.toThrow(
      'Кнопка «нет-такой-кнопки» не найдена',
    );
  });

  test('pressRaw: сырой код штампуется актуальным штампом экрана', async () => {
    await transport.handleStart(transport.makeBotContext(TG));
    const stamped = firstButtonCode(transport);
    const raw = stamped.slice(0, stamped.lastIndexOf(':'));
    const response = await transport.pressRaw(TG, raw);
    expect(response).not.toEqual({});
    expect(alerts()).toEqual([]);
  });

  test('waitForMessage: находит проактивное сообщение, в т.ч. появившееся позже', async () => {
    setTimeout(() => {
      void transport.api.sendMessage(TG, 'Привет, мир');
    }, 50);
    expect(await transport.waitForMessage(TG)).toBe('Привет, мир');
    expect(await transport.waitForMessage(TG, { contains: 'мир' })).toBe(
      'Привет, мир',
    );
  });

  test('waitForMessage: нет сообщения — undefined по таймауту, чужой адресат не считается', async () => {
    await transport.api.sendMessage(TG + 1, 'другому');
    expect(
      await transport.waitForMessage(TG, { timeoutMs: 80 }),
    ).toBeUndefined();
    await transport.api.sendMessage(TG, 'abc');
    expect(
      await transport.waitForMessage(TG, { contains: 'xyz', timeoutMs: 80 }),
    ).toBeUndefined();
  });

  test('api.failNext: следующий вызов метода бросает, затем всё работает; запись не ведётся', async () => {
    transport.api.failNext('sendMessage', new Error('telegram down'));
    await expect(transport.api.sendMessage(TG, 'a')).rejects.toThrow(
      'telegram down',
    );
    expect(transport.api.sentMessages).toEqual([]);
    await transport.api.sendMessage(TG, 'b');
    expect(transport.api.sentMessages.map((m) => m.text)).toEqual(['b']);
  });

  test('api.failNext: сбой другого метода не задевает sendMessage', async () => {
    transport.api.failNext('editMessageText');
    await transport.api.sendMessage(TG, 'ok');
    await expect(transport.api.editMessageText(TG, 1, 'e')).rejects.toThrow();
  });

  test('reset снимает заданный сбой', async () => {
    transport.api.failNext('sendMessage');
    transport.reset();
    await transport.api.sendMessage(TG, 'ok');
    expect(transport.api.sentMessages).toHaveLength(1);
  });
});

/** Код первой кнопки последнего экрана (после /start меню непустое). */
function firstButtonCode(transport: TestBotTransport): string {
  const screen = transport.api.sentMessages.find((m) => m.telegramId === TG);
  const btn = screen?.keyboard?.rows.flat()[0];
  if (!btn) throw new Error('После /start нет кнопок');
  return pressedCode(transport, TG, btn.text);
}
