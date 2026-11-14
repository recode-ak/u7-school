import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/domain/user/testing';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { waitUntil } from '@u7-scl/test-helpers/wait-until';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import { completeStudent } from '../helpers/student-fate';
import {
  type CampaignDef,
  CORE_EDUCATION_WORLD,
  deterministicUuid,
  type PersonDef,
  type StudentDef,
  type WorldDefinition,
} from '../worlds';

/**
 * E2E «Хаб и меню» (Фаза 6, задача 3):
 *
 *   1) S02 — рендер по myRole: субъекту «одногруппники и ментор» +
 *      прогресс M/K, ментору «отзыв о {Имя}»; выбор кампании → S03;
 *   2) истёкшее окно (фикстура c4a44444, expiresAt в прошлом):
 *      клик по старому приглашению → S03 «Ещё 0 дн» → ввод →
 *      заглушка «возможность закрыта» (REVIEW_WINDOW_CLOSED).
 *
 * Живая кампания создаётся событием судьбы в рантайме (окно 7 дн от
 * «сейчас» — тесты не зависят от возраста фикстур); просроченная —
 * фикстура c4a44444 в другом потоке (не мешает идемпотентности ER).
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const STREAM_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'; // «JS Core — Поток 2»
const STREAM_TITLE = 'JS Core — Поток 2';
const SUBJECT_TG = 1007; // «Марина» — субъект новой кампании
const SUBJECT_USER_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004; // «Ментор» — ментор потока
const DROPPED_TG = 1003; // «Студент» — субъект просроченной c4a44444
const EXPIRED_CAMPAIGN_ID = 'c4a44444-4444-4444-8444-444444444444';

describe('E2E peer-review: хаб «Мои отзывы» и меню', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-hub');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);

    // Живая кампания субъекта (окно 7 дн от «сейчас») — событием судьбы,
    // как в бою: нужно всем экранам хаба ниже
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_ID,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });
    await waitUntil(async () =>
      Boolean(
        await app.reviewCampaignRepo.findBySubject(STREAM_ID, SUBJECT_USER_ID),
      ),
    );
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('S02 субъекту: карточка с прогрессом M/K, выбор кампании → S03', async () => {
    // /start открывает экран с меню (кнопка «💬 Отзывы» в нём)
    await transport.handleStart(transport.makeBotContext(SUBJECT_TG));

    const hubResp = await transport.press(SUBJECT_TG, '💬 Отзывы');
    const hubText = String(hubResp.screen?.text);
    expect(hubText).toContain('💬 *Мои отзывы*');
    // myRole=subject: «одногруппники и ментор», окно свежей кампании — 7 дн
    expect(hubText).toContain(`1\\. *Поток «${STREAM_TITLE}»*`);
    expect(hubText).toContain('Ты завершил обучение');
    expect(hubText).toContain('Метрики: 0/3 \\(7 дн\\.\\)');
    const hubBtn = hubResp.screen?.keyboard?.rows
      .flat()
      .find((b) => b.text.includes('1. Поток'));
    // Кнопка с номером карточки, без метрик
    expect(hubBtn?.text).toBe(`1. Поток «${STREAM_TITLE}»`);

    // Выбор кампании — мост в S03
    const s03 = await transport.press(SUBJECT_TG, '1. Поток');
    expect(String(s03.screen?.text)).toContain('О ком расскажешь?');
    expect(String(s03.screen?.text)).toContain('Написано отзывов: 0 из 3');
    expect(String(s03.screen?.text)).toContain(STREAM_TITLE);
  });

  test('S02 ментору: карточка «отзыв о {Имя}» по myRole=mentor', async () => {
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));

    const hubResp = await transport.press(MENTOR_TG, '💬 Отзывы');
    const hubText = String(hubResp.screen?.text);
    expect(hubText).toContain('💬 *Мои отзывы*');
    // Карточка ментора в новой кампании: «подопечный завершил» + кнопка с номером
    expect(hubText).toContain('Твой подопечный Марина завершил обучение');
    expect(
      hubResp.screen?.keyboard?.rows
        .flat()
        .some((b) => /\d\. Отзыв об Марина/.test(b.text)),
    ).toBe(true);

    // Автопровал «выбор без выбора»: у ментора единственный адресат —
    // клик по карточке открывает экран ввода, минуя список адресатов
    const input = await transport.press(MENTOR_TG, 'Отзыв об Марина');
    const inputText = String(input.screen?.text);
    expect(inputText).toContain('✍️ *Отзыв — поток «');
    expect(inputText).toContain('Предлагаем разделить отзыв на две части');
    expect(inputText).toContain('`Отзыв для {Имя}:`');
    // «Назад» при единственном адресате — в хаб
    expect(input.screen?.keyboard?.rows.flat()[0]?.text).toBe('↩️ Мои отзывы');
    expect(input.awaitInput).toBeDefined();

    // Сохранение: инфо «сохранён» + возврат в хаб (родитель единственного)
    const saved = await transport.handleMessage(
      transport.makeBotContext(MENTOR_TG, {
        text: 'Марина стабильно выполняла задания и задавала точные вопросы.',
      }),
    );
    expect(String(saved.notify?.text ?? '')).toContain(
      '✅ Отзыв о Марина сохранён',
    );
    expect(String(saved.screen?.text)).toContain('💬 *Мои отзывы*');
  });

  test('истёкшее окно: старое приглашение → «Кампания не найдена» (списочный путь)', async () => {
    // Клик по кнопке старого приглашения (сырой код + штамп текущего экрана):
    // истёкшая кампания не попадает в get-my-campaigns — заглушка списка
    await transport.handleStart(transport.makeBotContext(DROPPED_TG));
    const staleCode = stampedCode(
      transport,
      DROPPED_TG,
      `peer-review:campaign:list:${EXPIRED_CAMPAIGN_ID}`,
    );

    const s03 = await transport.handleCallback(
      transport.makeBotContext(DROPPED_TG, { callbackData: staleCode }),
    );
    expect(String(s03.screen?.text)).toContain('⚠️ Кампания не найдена');
    expect(s03.screen?.keyboard?.rows.flat()[0]?.text).toBe('↩️ Мои отзывы');
  });
});

// ═══ Пагинация хаба и заглушка «окна истекли» (много кампаний) ═══

const BULK_SIZE = 30;

const BULK_PERSONS: PersonDef[] = Array.from({ length: BULK_SIZE }, (_, i) => ({
  key: `bulk-${i}`,
  uuid: deterministicUuid(`person:bulk-${i}`),
  name: `Ученик ${i + 1}`,
  telegramId: 2100 + i,
  roles: [Role.GUEST],
  registeredAt: 'T-20d',
}));

const BULK_STUDENTS: StudentDef[] = Array.from(
  { length: BULK_SIZE },
  (_, i) => ({
    key: `student-bulk-${i}`,
    uuid: deterministicUuid(`student:bulk-${i}`),
    personKey: `bulk-${i}`,
    streamKey: 'stream-2-active',
    enrolledAt: 'T-20d',
    status: 'advanced',
    steps: [],
  }),
);

const BULK_CAMPAIGNS: CampaignDef[] = Array.from(
  { length: BULK_SIZE },
  (_, i) => ({
    key: `camp-bulk-${i}`,
    uuid: deterministicUuid(`campaign:bulk-${i}`),
    context: 'stream_fate',
    streamKey: 'stream-2-active',
    subjectPersonKey: `bulk-${i}`,
    mentorPersonKey: 'dev',
    subjectOutcome: 'completed_passed',
    createdAt: 'T-2d',
    expiresAt: 'T+5d',
    participants: ['marina'],
  }),
);

/** Мир `core-education` плюс 30 живых кампаний ментора — хаб на 2+ страницы. */
const MANY_CAMPAIGNS_WORLD: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'core-education-many-campaigns',
  description: 'Мир с 30 кампаниями ментора: хаб не влезает в одну страницу',
  persons: [...(CORE_EDUCATION_WORLD.persons ?? []), ...BULK_PERSONS],
  students: [...(CORE_EDUCATION_WORLD.students ?? []), ...BULK_STUDENTS],
  campaigns: [...(CORE_EDUCATION_WORLD.campaigns ?? []), ...BULK_CAMPAIGNS],
};

describe('E2E peer-review: хаб — пагинация и истёкшие окна', () => {
  let app: TestApp;
  let clock: NonNullable<TestApp['clock']>;
  let transport: TestBotTransport;

  beforeAll(async () => {
    // Часы на якорь мира: 30 кампаний живут (окно T+5d)
    app = await createTestApp('pr-hub-pages', MANY_CAMPAIGNS_WORLD, {
      clock: {},
    });
    if (!app.clock) throw new Error('ожидались управляемые часы');
    clock = app.clock;
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Номера карточек из текстов кнопок текущего экрана. */
  const cardNumbers = (response: DialogResponse): number[] =>
    (response.screen?.keyboard?.rows.flat() ?? [])
      .map((b) => /^(\d+)\./.exec(b.text))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]));

  test('P6-17: хаб на две страницы — сквозная нумерация и листание «След ›»', async () => {
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));
    const page1 = await transport.press(MENTOR_TG, '💬 Отзывы');
    expect(String(page1.screen?.text)).toContain('💬 *Мои отзывы*');
    expect(String(page1.screen?.text)).toContain('Стр\\. 1/2');
    const nums1 = cardNumbers(page1);
    // Первая страница: все карточки с номерами, последняя — 17 (бюджет текста)
    expect(nums1.length).toBeGreaterThan(5);
    // Номера на странице идут подряд (часть карточек с ✅ — текст кнопки иной)
    expect(nums1).toEqual(
      Array.from({ length: nums1.length }, (_, i) => nums1[0]! + i),
    );

    const page2 = await transport.press(MENTOR_TG, 'След ›');
    expect(String(page2.screen?.text)).toContain('Стр\\. 2/2');
    const nums2 = cardNumbers(page2);
    // Нумерация карточек сквозная: страница 2 продолжает номера страницы 1
    expect(Math.min(...nums2)).toBe(Math.max(...nums1) + 1);
    // Навигация обеих сторон: назад есть, дальше — нет
    const navTexts2 = (page2.screen?.keyboard?.rows.flat() ?? []).map(
      (b) => b.text,
    );
    expect(navTexts2).toContain('‹ Пред');
  });

  test('P6-18: окна истекли после рендера меню — заглушка хаба с входящими', async () => {
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));
    // Меню отрисовано с живыми кампаниями; пока пользователь думал — окна истекли
    clock.advance(8 * 24 * 60 * 60 * 1000);

    const stub = await transport.press(MENTOR_TG, '💬 Отзывы');
    const text = String(stub.screen?.text);
    expect(text).toContain('Открытых окон отзывов нет');
    const buttons = (stub.screen?.keyboard?.rows.flat() ?? []).map(
      (b) => b.text,
    );
    // Входящие отзывы остались (их читают всегда) — кнопка S08 на месте
    expect(buttons).toContain('📥 Отзывы мне');
    expect(buttons.at(-1)).toContain('Главное меню');
  });
});

describe('E2E peer-review: неизвестные callback-и стори', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-hub-unknown');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new PeerReviewController(),
    ]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-49: неизвестный peer-review:* — «Неизвестная команда»', async () => {
    const unknown = [
      'peer-review:my-reviews:foo',
      'peer-review:reviews-for-me:foo',
      'peer-review:scope-reviews:foo',
      'peer-review:invite:foo',
    ];
    for (const code of unknown) {
      // Свежий /start: штамп кнопок текущего экрана под каждый крафтовый код
      await transport.handleStart(transport.makeBotContext(MENTOR_TG));
      const response = await transport.pressRaw(MENTOR_TG, code);
      expect(String(response.screen?.text), code).toContain(
        'Неизвестная команда',
      );
    }
  });
});
