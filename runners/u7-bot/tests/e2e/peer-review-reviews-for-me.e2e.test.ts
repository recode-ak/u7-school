import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import {
  CreateReviewUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { Trace } from 'dmg-core/app';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import { completeStudent } from '../helpers/student-fate';

/**
 * E2E «Отзывы мне» (S08):
 *
 *   1) после create-review кнопка «📥 Отзывы мне» в хабе появляется; S08:
 *      новые наверху (свежий отзыв Алексея — первая карточка 1/2,
 *      фиксурный Андрея — вторая карточка 2/2), листание
 *      «◀️ Пред.» / «След. ▶️», лейбл исхода у автора-студента;
 *      «↩️ Мои отзывы» возвращает в хаб;
 *   2) меню: живых кампаний нет, но отзывы есть → кнопка «💬 Отзывы»
 *      видна (Бот-админ — фиксурный отзыв -0004, ни в одной кампании);
 *      негатив «нет ни того, ни другого» — покрыт в peer-review-hub
 *      («Кандидат»).
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const STREAM_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'; // «JS Core — Поток 2»
const MODULE_ID = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
const MARINA_TG = 1007; // «Марина» — адресат фиксурного отзыва Андрея
const MARINA_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004; // «Ментор» — пишет Марине свежий отзыв (S08)
const MENTOR_ID = '44444444-4444-4444-4444-444444444444';
const BOT_ADMIN_TG = 8781337572; // адресат фиксурного отзыва -0004
const FIXTURE_REVIEW_TEXT = 'Работать в паре было легко';
// Без двоеточий/дефисов — MarkdownV2 экранирует спецсимволы в данных
const NEW_REVIEW_TEXT = 'Свежий отзыв за новый поток';

/** Ждёт условия (poll) — ER обрабатывает событие асинхронно. */
async function waitUntil(
  probe: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Судьба студента потока (исход «завершил и прошел») — настоящим UC ментора. */
function completeFate(app: TestApp, studentId: string) {
  return completeStudent(app, {
    callerTelegramId: MENTOR_TG,
    streamId: STREAM_ID,
    studentId,
    outcome: 'advanced',
  });
}

/** /start → хаб по кнопке меню «💬 Отзывы». */
async function openHub(transport: TestBotTransport, tgId: number) {
  await transport.handleStart(transport.makeBotContext(tgId));
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: pressedCode(transport, tgId, '💬 Отзывы'),
    }),
  );
}

describe('E2E peer-review: S08 «Отзывы мне»', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-s08');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);

    // Живая кампания Марины (окно 7 дн от «сейчас») — событием судьбы,
    // как в бою
    await completeFate(app, 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1');
    await waitUntil(async () =>
      Boolean(await app.reviewCampaignRepo.findBySubject(STREAM_ID, MARINA_ID)),
    );
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('отзыв появился → кнопка есть; S08: карточки 1/2 и 2/2, листание, лейблы, возврат', async () => {
    const marina = await app.userByTelegramId(MARINA_TG);
    const mentor = await app.userByTelegramId(MENTOR_TG);
    const campaign = (await app.reviewCampaignRepo.findBySubject(
      STREAM_ID,
      MARINA_ID,
    ))!;
    // Свежий отзыв ментора → Марина (createdAt «сейчас» > фиксурного);
    // писать субъекту окна может субъект или ментор — берём ментора
    const written = await app.apiApp.dispatch(
      PeerReviewModuleDef,
      CreateReviewUcDef.command({
        campaignId: campaign.uuid,
        recipientId: marina.user.uuid,
        text: NEW_REVIEW_TEXT,
      }),
      mentor,
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );
    expect(written.ok).toBe(true);

    const hub = await openHub(transport, MARINA_TG);
    const hubBtns = hub.screen?.keyboard?.rows.flat() ?? [];
    expect(hubBtns.some((b) => b.text === '📥 Отзывы мне')).toBe(true);

    // Штампованный код кнопки — из записанного экрана (как реальный клиент)
    const s08 = await transport.handleCallback(
      transport.makeBotContext(MARINA_TG, {
        callbackData: pressedCode(transport, MARINA_TG, 'Отзывы мне'),
      }),
    );
    const text = String(s08.screen?.text);
    expect(text).toContain('📥 *Отзывы мне* · 1/2');
    expect(text).toContain('👤 От: Алексей \\(ментор\\)');
    expect(text).toContain('📚 Поток: JS Core — Поток 2');
    expect(text).toContain(`«${NEW_REVIEW_TEXT}»`);
    expect(text).not.toContain(FIXTURE_REVIEW_TEXT);

    // Листание на следующую карточку
    const nextCode = pressedCode(transport, MARINA_TG, 'След. ▶️');
    const s08Page2 = await transport.handleCallback(
      transport.makeBotContext(MARINA_TG, {
        callbackData: nextCode,
      }),
    );
    const text2 = String(s08Page2.screen?.text);
    expect(text2).toContain('📥 *Отзывы мне* · 2/2');
    expect(text2).toContain('👤 От: Андрей \\(студент · завершил и прошел\\)');
    expect(text2).toContain('📚 Поток: JS Core — Поток 2');
    expect(text2).toContain(`«${FIXTURE_REVIEW_TEXT}`);
    expect(text2).not.toContain(NEW_REVIEW_TEXT);

    // Возврат «↩️ Мои отзывы» → хаб S02
    const hub2 = await transport.handleCallback(
      transport.makeBotContext(MARINA_TG, {
        callbackData: pressedCode(transport, MARINA_TG, 'Мои отзывы'),
      }),
    );
    expect(String(hub2.screen?.text)).toContain('💬 *Мои отзывы*');
  });

  test('меню: живых кампаний нет, но отзывы есть → кнопка «💬 Отзывы» видна', async () => {
    const botAdmin = await app.userByTelegramId(BOT_ADMIN_TG);

    const menu = await transport.collectMainMenu(botAdmin);

    expect(menu.some((b) => b.text === '💬 Отзывы')).toBe(true);
  });
});

const CANDIDATE_TG = 1002; // «Кандидат» — ни кампаний, ни отзывов
const CANDIDATE_ID = '22222222-2222-2222-2222-222222222222';
/** Автор и поток, которых нет в мире: карточка S08 рисует «неизвестно». */
const LOST_AUTHOR_ID = 'dead0004-0000-4000-8000-000000000004';
const LOST_STREAM_ID = 'dead0005-0000-4000-8000-000000000005';

describe('E2E peer-review: S08 — пусто и неизвестные ссылки', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-s08-gaps');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-42: отзывов нет — заглушка S08 с возвратом в хаб', async () => {
    await transport.handleStart(transport.makeBotContext(CANDIDATE_TG));
    // Гонка: кнопка в хабе скрыта (отзывов нет), но экран S08 открыт по коду
    const s08 = await transport.handleCallback(
      transport.makeBotContext(CANDIDATE_TG, {
        callbackData: stampedCode(
          transport,
          CANDIDATE_TG,
          'peer-review:reviews-for-me:view',
        ),
      }),
    );
    expect(String(s08.screen?.text)).toContain(
      'Тебе пока не написали ни одного отзыва',
    );
    const buttons = (s08.screen?.keyboard?.rows.flat() ?? []).map(
      (b) => b.text,
    );
    expect(buttons[0]).toBe('↩️ Мои отзывы');
    expect(buttons.at(-1)).toContain('Главное меню');
  });

  test('P6-43: имени автора и потока нет в мире — «неизвестно» в карточке', async () => {
    const reviewsPath = app.fixtures.peerReview.reviews;
    const original = await Bun.file(reviewsPath).text();
    const rows = JSON.parse(original) as Array<Record<string, unknown>>;
    const sample = rows[0]!;
    await Bun.write(
      reviewsPath,
      JSON.stringify(
        [
          ...rows,
          {
            ...sample,
            // Отзыв Кандидату от несуществующего автора о несуществующем потоке
            uuid: 'dead0006-0000-4000-8000-000000000006',
            campaignId: 'dead0007-0000-4000-8000-000000000007',
            scopeId: LOST_STREAM_ID,
            authorId: LOST_AUTHOR_ID,
            recipientId: CANDIDATE_ID,
            direction: 'student_mentor',
          },
        ],
        undefined,
        2,
      ),
    );

    try {
      await transport.handleStart(transport.makeBotContext(CANDIDATE_TG));
      const s08 = await transport.handleCallback(
        transport.makeBotContext(CANDIDATE_TG, {
          callbackData: stampedCode(
            transport,
            CANDIDATE_TG,
            'peer-review:reviews-for-me:view',
          ),
        }),
      );
      const text = String(s08.screen?.text);
      expect(text).toContain('👤 От: неизвестно');
      expect(text).toContain('📚 Поток: неизвестно');
      // Сам текст отзыва показывается: ссылки не резолвятся, карточка цела
      expect(text).toContain('Ментор давал понятную обратную связь');
    } finally {
      await Bun.write(reviewsPath, original);
    }
  });
});
