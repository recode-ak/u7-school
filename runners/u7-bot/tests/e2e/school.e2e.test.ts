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
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const GUEST_TG = 1001;

/** У школы мира нет сайта (TEST_SCHOOL): экран SH02 показывает заглушку. */
const SCHOOL_SITE_PLACEHOLDER = 'сайта пока нет, но скоро будет';

/** Сообщество школы из TEST_SCHOOL — URL-кнопка хаба SH01. */
const SCHOOL_COMMUNITY_URL = 'https://t.me/+communityInvite';

/** Кнопки экрана плоским списком. */
function buttonsOf(
  response: DialogResponse,
): Array<{ text: string; code: string; url?: string }> {
  return response.screen?.keyboard?.rows.flat() ?? [];
}

/** Открывает хаб школы: /start → «🏫 Школа» (диалог school/hub). */
async function openSchool(
  transport: TestBotTransport,
  tgId: number,
): Promise<DialogResponse> {
  await transport.handleStart(transport.makeBotContext(tgId));
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: pressedCode(transport, tgId, 'Школа'),
    }),
  );
}

/**
 * Нажимает кнопку экрана `response` (код штампуется текущим экраном —
 * как реальный клиент, нажимающий кнопку последнего сообщения).
 */
async function press(
  transport: TestBotTransport,
  tgId: number,
  response: DialogResponse,
  textContains: string,
): Promise<DialogResponse> {
  const button = buttonsOf(response).find((b) => b.text.includes(textContains));
  if (!button) throw new Error(`Кнопка «${textContains}» не найдена на экране`);
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: stampedCode(transport, tgId, button.code),
    }),
  );
}

/**
 * E2E хаба школы (SH01) и его экранов: «Инфо» (SH02), «Отзывы» (SH03),
 * сообщество. Путь — только кнопками: /start → «🏫 Школа» → раздел.
 *
 * Ветки рендера и отказы стори проверены unit-тестами
 * (`school-hub.story.test.ts`, `school-info.story.test.ts`,
 * `school-reviews.story.test.ts`); здесь — что проводка через транспорт,
 * домен и фикстуры мира действительно доводит пользователя до экрана.
 */
describe('E2E: хаб школы и его разделы (SH01–SH03)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;
  let tgId: number;

  beforeAll(async () => {
    app = await createTestApp('school-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
    ]);
    guest = await app.userByTelegramId(GUEST_TG);
    tgId = guest.user.view().telegramId;
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P1-14: хаб → «ℹ️ Инфо» — экран SH02 с названием, адресом, телефоном и сайтом', async () => {
    const hub = await openSchool(transport, tgId);
    expect(String(hub.screen?.text)).toContain('U7 School');

    const info = await press(transport, tgId, hub, 'Инфо');
    const text = String(info.screen?.text);

    expect(text).toContain('U7 School');
    expect(text).toContain('Мы учим не программированию');
    expect(text).toContain('📍 *Адрес:*');
    expect(text).toContain('Уральск');
    expect(text).toContain('📞 *Телефон:*');
    expect(text).toContain('287 8182');
    expect(text).toContain('🌐 *Сайт:*');

    const back = buttonsOf(info).find((b) => b.text.includes('Назад в школу'));
    expect(back).toBeDefined();
    expect(back?.code).toBe('school:hub:open');
  });

  test('P1-15: «Инфо» без заданного сайта — заглушка вместо ссылки', async () => {
    const info = await press(
      transport,
      tgId,
      await openSchool(transport, tgId),
      'Инфо',
    );

    expect(String(info.screen?.text)).toContain(SCHOOL_SITE_PLACEHOLDER);
  });

  test('P1-16: хаб → «💬 Отзывы» — карточка отзыва студента о менторе из потоков школы', async () => {
    const hub = await openSchool(transport, tgId);

    const reviews = await press(transport, tgId, hub, 'Отзывы');
    const text = String(reviews.screen?.text);

    // Заголовок с индикатором карточки: отзывы собраны по всем потокам школы
    expect(text).toContain('💬 *Отзывы о школе* · 1/');
    // Карточка: ментор, автор со статусом, поток, дата ДД.ММ.ГГГГ, текст
    expect(text).toContain('👨‍🏫 Ментор: ');
    expect(text).toContain('👤 От: ');
    expect(text).toContain('\\(студент · ');
    expect(text).toContain('📚 Поток: JS Core');
    expect(text).toMatch(/📅 Дата: \d{2}\\\.\d{2}\\\.\d{4}/);
    expect(text).toContain('💬 «');

    const back = buttonsOf(reviews).find((b) =>
      b.text.includes('Назад в школу'),
    );
    expect(back).toBeDefined();
    expect(back?.code).toBe('school:hub:open');
  });

  test('P1-17: «Отзывы» — листание ◀️ Пред. / След. ▶️ и границы карточек', async () => {
    const page0 = await press(
      transport,
      tgId,
      await openSchool(transport, tgId),
      'Отзывы',
    );
    // На первой карточке «Пред.» нет, «След.» есть
    expect(String(page0.screen?.text)).toMatch(/· 1\/\d+/);
    expect(buttonsOf(page0).some((b) => b.text.includes('◀️ Пред.'))).toBe(
      false,
    );
    expect(buttonsOf(page0).some((b) => b.text.includes('След. ▶️'))).toBe(true);

    const page1 = await press(transport, tgId, page0, 'След. ▶️');
    expect(String(page1.screen?.text)).toMatch(/· 2\/\d+/);
    expect(buttonsOf(page1).some((b) => b.text.includes('◀️ Пред.'))).toBe(true);

    // Последняя карточка: «След.» нет, «Пред.» есть
    const page2 = await press(transport, tgId, page1, 'След. ▶️');
    const total = /· (\d+)\/\d+/.exec(String(page2.screen?.text))?.[1];
    expect(total).toBeDefined();
    const lastText = String(page2.screen?.text);
    expect(lastText).toMatch(new RegExp(`· ${total}/\\d+`));
    expect(buttonsOf(page2).some((b) => b.text.includes('След. ▶️'))).toBe(
      false,
    );

    // Назад на предыдущую карточку
    const backPage = await press(transport, tgId, page2, '◀️ Пред.');
    expect(String(backPage.screen?.text)).toMatch(
      new RegExp(`· ${Number(total) - 1}/\\d+`),
    );
  });

  test('P1-17: номер страницы не число — показывается первая карточка', async () => {
    await transport.handleStart(transport.makeBotContext(tgId));

    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: stampedCode(transport, tgId, 'school:reviews:list:abc'),
      }),
    );

    expect(String(response.screen?.text)).toMatch(/· 1\/\d+/);
  });

  test('P1-20: хаб → «👥 Сообщество» — URL-кнопка на группу школы, без callback', async () => {
    const hub = await openSchool(transport, tgId);

    const community = buttonsOf(hub).find((b) => b.text.includes('Сообщество'));
    expect(community).toBeDefined();
    expect(community?.url).toBe(SCHOOL_COMMUNITY_URL);
    // Внешний переход: callback_data у кнопки не создаётся
    expect(community?.code).toBe('');
    // Экран в Telegram несёт ту же URL-кнопку (без callback_data)
    const rendered = transport.api.sentMessages
      .filter((m) => m.telegramId === tgId)
      .reverse()
      .flatMap((m) => m.keyboard?.rows.flat() ?? [])
      .find((b) => b.text.includes('Сообщество'));
    expect(rendered?.url).toBe(SCHOOL_COMMUNITY_URL);
    expect(rendered?.code).toBe('');
  });

  test('P1-22: неизвестное действие внутри стори school — экран «⚠️ Неизвестная команда»', async () => {
    for (const raw of [
      'school:hub:xyz',
      'school:info:xyz',
      'school:community:xyz',
    ]) {
      // Свежий экран меню: /start двигает seq, старый штамп мёртв
      await transport.handleStart(transport.makeBotContext(tgId));
      const response = await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: stampedCode(transport, tgId, raw),
        }),
      );
      expect(String(response.screen?.text)).toContain('Неизвестная команда');
    }
  });
});

/** Мир без отзывов: потоки школы есть, кампаний и отзывов нет. */
const WORLD_WITHOUT_REVIEWS: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'school-without-reviews',
  campaigns: [],
  reviews: [],
};

describe('E2E: «Отзывы» без данных (SH03)', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('school-empty-e2e', WORLD_WITHOUT_REVIEWS);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P1-18: у школы нет отзывов — заглушка с кнопкой «Назад в школу»', async () => {
    const hub = await openSchool(transport, GUEST_TG);
    // Хаб школы открывается и при пустом срезе отзывов
    expect(String(hub.screen?.text)).toContain('U7 School');

    const reviews = await press(transport, GUEST_TG, hub, 'Отзывы');

    expect(String(reviews.screen?.text)).toContain('Пока нет отзывов о школе');
    const back = buttonsOf(reviews).find((b) =>
      b.text.includes('Назад в школу'),
    );
    expect(back).toBeDefined();
    expect(back?.code).toBe('school:hub:open');
  });
});

/**
 * Мир, где у отзыва нет имён: кампания ссылается на несуществующего
 * студента (поток завершён — инвариант мира это допускает), автор отзыва
 * тоже не из `persons`. Живых student_mentor отзывов не осталось, поэтому
 * в срезе школы ровно одна карточка — с заглушками имён.
 */
const WORLD_WITH_UNKNOWN_NAMES: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'school-unknown-names',
  campaigns: [
    ...(CORE_EDUCATION_WORLD.campaigns ?? []),
    {
      key: 'camp-ghost-subject',
      context: 'stream_fate',
      streamKey: 'stream-1-completed',
      subjectPersonKey: 'ghost-student',
      mentorPersonKey: 'dev',
      subjectOutcome: 'dropped',
      createdAt: 'T-2d',
      expiresAt: 'T+5d',
      participants: [],
    },
  ],
  reviews: [
    ...(CORE_EDUCATION_WORLD.reviews ?? []).filter(
      (r) => r.direction !== 'student_mentor',
    ),
    {
      key: 'rev-ghost-names',
      campaignKey: 'camp-ghost-subject',
      authorPersonKey: 'ghost-author',
      recipientPersonKey: 'ghost-student',
      direction: 'student_mentor',
      authorOutcome: 'dropped',
      text: 'Отзыв без имён',
      createdAt: 'T-1d',
    },
  ],
};

describe('E2E: «Отзывы» с неизвестными именами (SH03)', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp(
      'school-unknown-names-e2e',
      WORLD_WITH_UNKNOWN_NAMES,
    );
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P1-19: имя ментора и автора не нашлось — подставляется «неизвестно»', async () => {
    const reviews = await press(
      transport,
      GUEST_TG,
      await openSchool(transport, GUEST_TG),
      'Отзывы',
    );

    const text = String(reviews.screen?.text);
    expect(text).toContain('👨‍🏫 Ментор: неизвестно');
    expect(text).toContain('👤 От: неизвестно');
    // Поток отзыва — реальный поток школы, его имя находится
    expect(text).toContain('📚 Поток: JS Core');
    expect(text).toContain('Отзыв без имён');
  });
});
