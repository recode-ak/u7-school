import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  CreateReviewUcDef,
  ListScopeReviewsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { testTrace } from 'dmg-core/testing';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import { completeStudent } from '../helpers/student-fate';

/**
 * E2E «Просмотр S07 из карточки потока» (Фаза 6, задача 4):
 *
 * Контур A (фикстуры): кнопка «💬 Отзывы» в карточке потока открывает S07
 * (заголовок потока) — мост между контроллерами через настоящий
 * callback_data; «⬅️ Назад к потоку» — обратный мост в карточку.
 *
 * Контур B (свой стенд): пагинация ≥3 страниц — 4 отзыва по ~3400 симв.
 * создаются в рантайме (событие судьбы → create-review), страница = один
 * блок; полный цикл листания, edit на месте, DialogCache — тыки страниц
 * не перечитывают домен (счётчик list-scope-reviews через прокси apiApp).
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const GUEST_TG = 1001; // «Гость» — читатель карточки потока
const STREAM_WITH_REVIEWS = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'; // JS Core — Поток 2
const SUBJECT_TG = 1007; // «Марина» — субъект кампании контура B
const SUBJECT_USER_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004;
const MENTOR_USER_ID = '44444444-4444-4444-4444-444444444444';

/** Прокси над apiApp: считает вызовы dispatch по имени UC (для кеш-ассертов). */
function countingApi(app: TestApp): {
  api: typeof app.apiApp;
  count: (name: string) => number;
} {
  const counts = new Map<string, number>();
  const api = new Proxy(app.apiApp, {
    get(target, prop, receiver) {
      if (prop === 'dispatch') {
        return async (
          module: unknown,
          command: { uc: string },
          ...rest: unknown[]
        ) => {
          counts.set(command.uc, (counts.get(command.uc) ?? 0) + 1);
          return (
            target as unknown as {
              dispatch: (...a: unknown[]) => Promise<unknown>;
            }
          ).dispatch(module, command, ...rest);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { api, count: (name) => counts.get(name) ?? 0 };
}

/** Стенд: TestApp + транспорт (все контроллеры карточки и S07). */
async function makeStand(tag: string, withCounter = false) {
  const app = await createTestApp(tag);
  const counter = withCounter ? countingApi(app) : undefined;
  const transport = createTestBotTransport(
    counter ? { ...app, apiApp: counter.api } : app,
    [
      new AppController(SCHOOL_GROUP_URL),
      new StreamsController(),
      new PeerReviewController(),
    ],
  );
  return { app, transport, counter };
}

/** Карточка потока: /start + сырой код view-stream с актуальным штампом. */
async function openStreamCard(
  transport: TestBotTransport,
  tgId: number,
  streamId: string,
) {
  await transport.handleStart(transport.makeBotContext(tgId));
  return transport.pressRaw(tgId, `stream:view-stream:view:${streamId}`);
}

/** Экран в хронологии отображения (sent, затем его edits по порядку). */
interface ScreenRecord {
  messageId: number;
  text: string;
}

/** Хронология экранов пользователя (sent + относящиеся к ним edits). */
function screenHistory(
  transport: TestBotTransport,
  tgId: number,
): ScreenRecord[] {
  const history: ScreenRecord[] = [];
  for (const sent of transport.api.sentMessages.filter(
    (s) => s.telegramId === tgId,
  )) {
    history.push({ messageId: sent.messageId, text: sent.text });
    for (const edit of transport.api.editedMessages.filter(
      (e) => e.telegramId === tgId && e.messageId === sent.messageId,
    )) {
      history.push({ messageId: edit.messageId, text: edit.text });
    }
  }
  return history;
}

/** Текст последнего экрана пользователя (send или edit). */
function lastScreenText(transport: TestBotTransport, tgId: number): string {
  const history = screenHistory(transport, tgId);
  return history[history.length - 1]?.text ?? '';
}

/** Индикатор страницы `Стр. N/M` → {index, total} (1-based) или null. */
function pageOf(text: string): { index: number; total: number } | null {
  const m = /Стр\\\. (\d+)\/(\d+)/.exec(text);
  return m ? { index: Number(m[1]), total: Number(m[2]) } : null;
}

/** Длинный отзыв (~3300 симв.): маркер один раз + повторяющийся текст. */
function longReview(marker: string): string {
  const filler =
    'Подробный разбор работы за поток: темы, темп, обратная связь, ' +
    'командные привычки и личные наблюдения. ';
  return `${marker} ${filler.repeat(Math.ceil(3300 / filler.length)).slice(0, 3300)}`;
}

// ═══ Контур A: карточка потока и контент S07 (фикстуры) ═══

describe('E2E peer-review: S07 из карточки потока — контент', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    ({ app, transport } = await makeStand('pr-view'));
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('карточка с отзывами — кнопка открывает S07', async () => {
    transport.reset();
    const card = await openStreamCard(transport, GUEST_TG, STREAM_WITH_REVIEWS);
    expect(
      card.screen?.keyboard?.rows.flat().some((b) => b.text === '💬 Отзывы'),
    ).toBe(true);

    const s07 = await transport.press(GUEST_TG, '💬 Отзывы');
    const text = String(s07.screen?.text);
    expect(text).toContain('💬 *Отзывы* — поток «JS Core — Поток 2»');
    // Кнопка возврата в карточку потока
    expect(
      s07.screen?.keyboard?.rows
        .flat()
        .some((b) => b.text === '⬅️ Назад к потоку'),
    ).toBe(true);
  });

  test('«⬅️ Назад к потоку» — мост в карточку потока', async () => {
    const back = await transport.press(GUEST_TG, '⬅️ Назад к потоку');
    const text = String(back.screen?.text);
    expect(text).toContain('JS Core — Поток 2');
    // Карточка потока (streams S02): ментор и кнопки карточки
    expect(text).toContain('Ментор');
    expect(
      back.screen?.keyboard?.rows.flat().some((b) => b.text === '👥 Студенты'),
    ).toBe(true);
  });
});

// ═══ Контур B: пагинация S07 (длинные отзывы в рантайме) ═══

describe('E2E peer-review: S07 — пагинация и DialogCache', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let counter: ReturnType<typeof countingApi> | undefined;

  beforeAll(async () => {
    const stand = await makeStand('pr-view-paged', true);
    app = stand.app;
    transport = stand.transport;
    counter = stand.counter;

    // Кампания судьбой + 4 длинных отзыва (страница = один блок)
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_WITH_REVIEWS,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });
    const deadline = Date.now() + 3000;
    while (
      !(await app.reviewCampaignRepo.findBySubject(
        STREAM_WITH_REVIEWS,
        SUBJECT_USER_ID,
      )) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 20));
    }

    const subject = await app.userByTelegramId(SUBJECT_TG);
    const mentor = await app.userByTelegramId(MENTOR_TG);
    const campaign = (await app.reviewCampaignRepo.findBySubject(
      STREAM_WITH_REVIEWS,
      SUBJECT_USER_ID,
    ))!;
    const reviews: Array<[string, string]> = [
      [MENTOR_USER_ID, longReview('D1: отзыв ментору за поток.')],
      [
        '33333333-3333-3333-3333-333333333333',
        longReview('D2: отзыв соучастнику о командной работе.'),
      ],
      [
        '88888888-8888-4888-8888-888888888888',
        longReview('D3: отзыв соучастнику о темпе.'),
      ],
      [SUBJECT_USER_ID, longReview('D4: отзыв ментора о студенте.')],
    ];
    for (const [recipientId, text] of reviews) {
      const written = await app.apiApp.dispatch(
        PeerReviewModuleDef,
        CreateReviewUcDef.command({
          campaignId: campaign.uuid,
          recipientId,
          text,
        }),
        recipientId === SUBJECT_USER_ID ? mentor : subject,
        testTrace(),
      );
      expect(written.ok).toBe(true);
    }

    // Открываем S07: карточка потока → кнопка «💬 Отзывы»
    await openStreamCard(transport, GUEST_TG, STREAM_WITH_REVIEWS);
    await transport.press(GUEST_TG, '💬 Отзывы');
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('≥3 страниц: полный цикл листания, edit на месте, домен не перечитывается', async () => {
    const first = pageOf(lastScreenText(transport, GUEST_TG));
    expect(first?.total).toBeGreaterThanOrEqual(3);
    expect(first?.index).toBe(1);

    // Открытие S07 = один build (чтение домена)
    expect(counter?.count(ListScopeReviewsUcDef.name)).toBe(1);

    const s07MessageId = transport.api.sentMessages
      .filter((s) => s.telegramId === GUEST_TG)
      .at(-1)!.messageId;

    /** Тексты всех страниц по циклу «След ›» до конца, затем «‹ Пред» до 1-й. */
    const pageTexts: string[] = [];
    const editInPlaceSteps: number[] = [];
    const pressNav = async (label: string) => {
      await transport.press(GUEST_TG, label);
      pageTexts.push(lastScreenText(transport, GUEST_TG));
      const lastEdit = transport.api.editedMessages
        .filter((e) => e.telegramId === GUEST_TG)
        .at(-1)!;
      editInPlaceSteps.push(lastEdit.messageId);
    };

    // вперёд до конца
    for (let i = 1; i < first!.total; i++) {
      await pressNav('След ›');
    }
    const total = first!.total;
    // назад к первой
    for (let i = 1; i < total; i++) {
      await pressNav('‹ Пред');
    }

    // Порядок страниц: вперёд 2..total, назад total-1..1
    const indices = pageTexts.map((t) => pageOf(t)?.index);
    expect(indices).toEqual([
      ...Array.from({ length: total - 1 }, (_, i) => i + 2),
      ...Array.from({ length: total - 1 }, (_, i) => total - 1 - i),
    ]);

    // Каждый edit — на месте (тот же messageId исходного экрана S07)
    expect(new Set(editInPlaceSteps).size).toBe(1);
    expect(editInPlaceSteps[0]).toBe(s07MessageId);

    // Целые блоки без потерь: все 4 длинных отзыва — ровно по одному разу
    // (createdAt рантайм-отзывов совпадает до минуты — порядок страниц
    // недетерминирован, поэтому проверяем распределение, а не порядок)
    const allTexts = [
      lastScreenText(transport, GUEST_TG),
      ...pageTexts.slice(0, total - 1), // страницы вперёд (без обратного пути)
    ].join('\n');
    for (const marker of ['D1:', 'D2:', 'D3:', 'D4:']) {
      expect(allTexts.split(marker).length).toBe(2); // ровно одно вхождение
    }
    // Фикстурные короткие отзывы тоже целы (перенесены на дальние страницы)
    expect(allTexts).toContain('Ментор давал понятную');
    expect(allTexts).toContain('Студент дисциплинированно');
    expect(allTexts).toContain('Работать в паре');

    // DialogCache: все тыки — из кеша, list-scope-reviews не звался
    expect(counter?.count(ListScopeReviewsUcDef.name)).toBe(1);
  });
});

// ═══ Контур C: S07 без отзывов и менторская карточка (P6-47, P4-70) ═══

const EMPTY_STREAM_ID = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0'; // «JS Core — Поток 1»

describe('E2E peer-review: S07 без отзывов и менторская карточка', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-view-gaps');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new StreamsController(),
      new MentorController(),
      new PeerReviewController(),
    ]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-47: отзывов по потоку нет — заглушка S07 с возвратом к потоку', async () => {
    await transport.handleStart(transport.makeBotContext(GUEST_TG));
    // Кнопка в карточке скрыта (отзывов нет) — экран открыт по коду, как из гонки
    const s07 = await transport.pressRaw(
      GUEST_TG,
      `peer-review:scope-reviews:view:${EMPTY_STREAM_ID}`,
    );
    expect(String(s07.screen?.text)).toContain('Отзывов по потоку пока нет');
    const back = (s07.screen?.keyboard?.rows.flat() ?? []).find(
      (b) => b.text === '⬅️ Назад к потоку',
    );
    expect(back?.code).toContain(EMPTY_STREAM_ID);
  });

  test('P4-70: менторская карточка потока — «💬 Отзывы» не показывается', async () => {
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));
    await transport.press(MENTOR_TG, 'Инструменты ментора');
    await transport.press(MENTOR_TG, 'Мои потоки');
    await transport.press(MENTOR_TG, '🔵');

    // ui-spec (Q-05): в менторской карточке отзывы не дублируются —
    // они читаются из публичной карточки потока S02
    const buttons = (lastScreenButtons(transport, MENTOR_TG) ?? []).map(
      (b) => b.text,
    );
    expect(buttons.some((t) => t.includes('Студенты'))).toBe(true);
    expect(buttons.some((t) => t.includes('Отзывы'))).toBe(false);
  });
});

/** Кнопки последнего экрана пользователя (send или edit). */
function lastScreenButtons(transport: TestBotTransport, tgId: number) {
  return transport.api.sentMessages
    .filter((s) => s.telegramId === tgId)
    .at(-1)
    ?.keyboard?.rows.flat();
}
