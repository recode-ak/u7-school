import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import type { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MessengerEvent } from '@u7-scl/core/ui';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  TestBotTransport,
  type TestBotTransport as Transport,
} from '@u7-scl/test-helpers/test-bot-transport';

/**
 * E2E событий групп (`chat_member` / `my_chat_member`) через транспорт —
 * как их доставляет main.ts после проводки Q-01/Q-02.
 *
 * Проверяется цепочка контроллеров: событие поглощается (`stop`) или идёт
 * дальше (`pass`). Наблюдаемость `stop`/`pass` даёт контроллер-шпион в конце
 * цепочки: он видит событие только после всех `pass`.
 *
 * Реакции школьной группы: SUBSCRIBER по входу/выходу (FR-7); группы потока:
 * уведомление ментору о неизвестном участнике (FR-7).
 */

/** Группа сообщества школы (TEST_SCHOOL.communityGroup). */
const SCHOOL_GROUP_ID = '-100123456789';
/** Группа потока «JS Core — Поток 2» (студент f0f0, ментор 1004). */
const STREAM2_GROUP_ID = '-1002222222222';
/** Чат, не привязанный ни к школе, ни к потоку. */
const FOREIGN_CHAT_ID = '-1007777777777';

const GUEST_TG = 1001; // «Гость», без SUBSCRIBER
const CANDIDATE_TG = 1002; // «Кандидат», уже SUBSCRIBER
const STUDENT_TG = 1003; // «Андрей», активный студент потока
const MENTOR_TG = 1004;
const OUTSIDER_TG = 100000011; // «Дмитрий» — есть в БД, но не студент потока

/**
 * Контроллер-шпион в конце цепочки: фиксирует события, дошедшие до него
 * (то есть все предыдущие контроллеры ответили не `stop`).
 */
class RecordingController extends U7BotController {
  readonly name = 'recording';
  protected override readonly stories: U7BotUiStory[] = [];
  readonly events: MessengerEvent[] = [];

  override async handleMessengerEvent(event: MessengerEvent): Promise<'pass'> {
    this.events.push(event);
    return 'pass';
  }
}

interface Stand {
  app: TestApp;
  transport: Transport;
  spy: RecordingController;
}

async function createGroupStand(
  tag: string,
  opts: { botAdminUuid?: string } = {},
): Promise<Stand> {
  const app = await createTestApp(tag);
  const spy = new RecordingController();
  const transport = new TestBotTransport(
    app.apiApp,
    (tgId) => app.userByTelegramId(tgId),
    [new SchoolController(), new StreamsController(), spy],
    {
      eventBus: app.eventBus,
      callers: app.callers,
      ...(opts.botAdminUuid !== undefined
        ? { botAdminUuid: opts.botAdminUuid }
        : {}),
    },
  );
  return { app, transport, spy };
}

/** Есть ли у пользователя роль (по свежему резолву актора из БД). */
async function hasRole(
  app: TestApp,
  telegramId: number,
  role: 'SUBSCRIBER',
): Promise<boolean> {
  const actor: U7BotActor = await app.userByTelegramId(telegramId);
  return actor.user.hasRole(role);
}

/** Ждёт проактивного сообщения адресату (poll sentMessages). */
async function waitMessageFor(
  transport: Transport,
  telegramId: number,
  timeoutMs = 3000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = transport.api.sentMessages.find(
      (m) => m.telegramId === telegramId,
    );
    if (found) return found.text;
    await new Promise((r) => setTimeout(r, 20));
  }
  return undefined;
}

describe('E2E: события школьной группы (SUBSCRIBER)', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createGroupStand('group-events-school');
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('P1-45: бот добавлен в группу школы — добавивший получает SUBSCRIBER, stop', async () => {
    const { app, transport, spy } = stand;
    expect(await hasRole(app, GUEST_TG, 'SUBSCRIBER')).toBe(false);

    await transport.myChatMember({
      chatId: SCHOOL_GROUP_ID,
      from: { id: GUEST_TG, first_name: 'Гость', username: 'guest' },
      oldStatus: 'left',
      newStatus: 'member',
    });

    expect(await hasRole(app, GUEST_TG, 'SUBSCRIBER')).toBe(true);
    // Событие поглощено школьным контроллером — шпион его не увидел
    expect(spy.events).toEqual([]);
    // Никаких сообщений в чат: реакция молчаливая
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P1-46: бот удалён из группы школы — роли не меняются, stop', async () => {
    const { app, transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();

    await transport.myChatMember({
      chatId: SCHOOL_GROUP_ID,
      from: { id: CANDIDATE_TG, first_name: 'Кандидат' },
      oldStatus: 'member',
      newStatus: 'left',
    });

    // SUBSCRIBER остаётся: удаление бота роли не снимает
    expect(await hasRole(app, CANDIDATE_TG, 'SUBSCRIBER')).toBe(true);
    expect(spy.events).toEqual([]);
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P1-47: событие из чужого чата — pass, роли не трогаются', async () => {
    const { app, transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();
    const before = await hasRole(app, GUEST_TG, 'SUBSCRIBER');

    await transport.chatMember({
      chatId: FOREIGN_CHAT_ID,
      user: { id: OUTSIDER_TG, first_name: 'Дмитрий' },
      oldStatus: 'left',
      newStatus: 'member',
    });

    // Школьный контроллер вернул «чужая группа — pass»: событие дошло до конца
    expect(spy.events).toHaveLength(1);
    expect(spy.events[0]?.kind).toBe('member_joined');
    expect(await hasRole(app, GUEST_TG, 'SUBSCRIBER')).toBe(before);
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P1-47: смена прав member→administrator без смены членства — событие не порождается', async () => {
    const { app, transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();
    const before = await hasRole(app, CANDIDATE_TG, 'SUBSCRIBER');

    await transport.chatMember({
      chatId: SCHOOL_GROUP_ID,
      user: { id: CANDIDATE_TG, first_name: 'Кандидат' },
      oldStatus: 'member',
      newStatus: 'administrator',
    });

    // Оба статуса «в группе» — транспорт не публикует ни входа, ни выхода
    expect(spy.events).toEqual([]);
    expect(await hasRole(app, CANDIDATE_TG, 'SUBSCRIBER')).toBe(before);
    expect(transport.api.sentMessages).toEqual([]);
  });
});

describe('E2E: сбой при обработке события школьной группы', () => {
  let stand: Stand;

  beforeAll(async () => {
    const app = await createTestApp('group-events-school-fail');
    const guest = await app.userByTelegramId(GUEST_TG);
    const spy = new RecordingController();
    // Отказ UC смены роли: бот действует от имени пользователя без права
    // управлять ролями (в бою — сбой или недоступность модуля `user`)
    stand = {
      app,
      spy,
      transport: new TestBotTransport(
        app.apiApp,
        (tgId) => app.userByTelegramId(tgId),
        [new SchoolController(), spy],
        {
          eventBus: app.eventBus,
          callers: app.callers,
          botAdminUuid: guest.user.uuid,
        },
      ),
    };
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('P1-48: ошибка смены роли — warn-лог, stop, приложение не падает', async () => {
    const { app, transport, spy } = stand;
    const outcast = 100000012; // «Иван» — SUBSCRIBER нет, добавит некому

    await transport.myChatMember({
      chatId: SCHOOL_GROUP_ID,
      from: { id: outcast, first_name: 'Иван' },
      oldStatus: 'left',
      newStatus: 'member',
    });

    // Роль не выдана: отказ UC проглочен обработчиком (warn в лог)
    expect(await hasRole(app, outcast, 'SUBSCRIBER')).toBe(false);
    expect(spy.events).toEqual([]);
    expect(transport.api.sentMessages).toEqual([]);
  });
});

describe('E2E: события группы потока (ментору об участниках)', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createGroupStand('group-events-stream');
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('P4-63: вступил участник вне активных студентов — ментору предупреждение, stop', async () => {
    const { transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();

    await transport.chatMember({
      chatId: STREAM2_GROUP_ID,
      user: {
        id: OUTSIDER_TG,
        first_name: 'Дмитрий',
        username: 'dmitry',
      },
      oldStatus: 'left',
      newStatus: 'member',
    });

    const notice = await waitMessageFor(transport, MENTOR_TG);
    expect(notice).toBeDefined();
    expect(notice).toContain(
      '⚠️ В группу «JS Core — Поток 2» вступил неизвестный участник',
    );
    expect(notice).toContain('Дмитрий \\(@dmitry\\)');
    expect(notice).toContain('Он не числится студентом этого потока');
    expect(spy.events).toEqual([]);
  });

  test('P4-64: вступил активный студент — уведомления нет, stop', async () => {
    const { transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();

    await transport.chatMember({
      chatId: STREAM2_GROUP_ID,
      user: { id: STUDENT_TG, first_name: 'Андрей' },
      oldStatus: 'left',
      newStatus: 'member',
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(transport.api.sentMessages).toEqual([]);
    expect(spy.events).toEqual([]);
  });

  test('P4-67: событие из чата, не привязанного к потоку — pass', async () => {
    const { transport, spy } = stand;
    spy.events.length = 0;
    transport.reset();

    await transport.chatMember({
      chatId: FOREIGN_CHAT_ID,
      user: { id: OUTSIDER_TG, first_name: 'Дмитрий' },
      oldStatus: 'left',
      newStatus: 'member',
    });

    // Контроллер потоков не нашёл поток → pass: событие идёт дальше по цепочке
    expect(spy.events).toHaveLength(1);
    expect(spy.events[0]?.chatId).toBe(FOREIGN_CHAT_ID);
    expect(transport.api.sentMessages).toEqual([]);
  });
});
