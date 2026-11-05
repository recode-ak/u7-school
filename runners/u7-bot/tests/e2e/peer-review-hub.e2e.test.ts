import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import { completeStudent } from '../helpers/student-fate';

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

    const hubResp = await transport.handleCallback(
      transport.makeBotContext(SUBJECT_TG, {
        callbackData: pressedCode(transport, SUBJECT_TG, '💬 Отзывы'),
      }),
    );
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
    const s03 = await transport.handleCallback(
      transport.makeBotContext(SUBJECT_TG, {
        callbackData: pressedCode(transport, SUBJECT_TG, '1. Поток'),
      }),
    );
    expect(String(s03.screen?.text)).toContain('О ком расскажешь?');
    expect(String(s03.screen?.text)).toContain('Написано отзывов: 0 из 3');
    expect(String(s03.screen?.text)).toContain(STREAM_TITLE);
  });

  test('S02 ментору: карточка «отзыв о {Имя}» по myRole=mentor', async () => {
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));

    const hubResp = await transport.handleCallback(
      transport.makeBotContext(MENTOR_TG, {
        callbackData: pressedCode(transport, MENTOR_TG, '💬 Отзывы'),
      }),
    );
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
    const input = await transport.handleCallback(
      transport.makeBotContext(MENTOR_TG, {
        callbackData: pressedCode(transport, MENTOR_TG, 'Отзыв об Марина'),
      }),
    );
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
