import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import type {
  SentMessage,
  TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import {
  createTestBotTransport,
  pressedCode,
  screensNewFirst,
} from '@u7-scl/test-helpers/test-bot-transport';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';

/**
 * E2E: UX анкет (spec FR-1/FR-2) и приглашения продолжить
 * (spec FR-5, вариант A — кнопка-мост).
 *
 * Уровень Telegram: проверяются РЕАЛЬНЫЕ вызовы sendMessage/editMessageText —
 * финализация вопросов (маркеры, снятие клавиатур), тогглы на месте,
 * приглашения канала invite. Нажатия — отштампованными кодами из Api-записей
 * (как реальный клиент). Пул анкетного курса (3 вопроса):
 * Q1 radio → Q2 text → Q3 multiple.
 */

const QUESTIONNAIRE_COURSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
// Поток с кодовым словом (enroll-key) — «чужой» флоу в сценарии приглашения
const ENROLL_KEY_STREAM = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4';

describe('Questionnaire UX (e2e)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  // fillGuest — сценарий приглашения: GUEST (видит «Записаться» в карточке потока).
  let fillGuest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('questionnaire-ux-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new CoursesController(),
      new StreamsController(),
      new QuestionnaireController(),
    ]);
    fillGuest = await app.userByTelegramId(1007);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  async function waitFor<T>(
    what: string,
    probe: () => T | undefined,
    timeoutMs = 3000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = probe();
      if (found !== undefined) return found;
      if (Date.now() > deadline) {
        throw new Error(`Таймаут ожидания: ${what}`);
      }
      await Bun.sleep(25);
    }
  }

  function waitForSent(
    tgId: number,
    textContains: string,
  ): Promise<SentMessage> {
    return waitFor(`сообщение «${textContains}»`, () =>
      transport.api.sentMessages.find(
        (m) => m.telegramId === tgId && m.text.includes(textContains),
      ),
    );
  }

  /**
   * Ждёт экран с текстом (send или edit): drill-down внутри одной стори
   * рендерится edit'ом на месте (seq не растёт) — сообщения может не быть.
   */
  function waitForScreen(
    tgId: number,
    textContains: string,
  ): Promise<SentMessage | (typeof transport.api.editedMessages)[number]> {
    return waitFor(`экран «${textContains}»`, () => {
      const edited = transport.api.editedMessages.find(
        (e) => e.telegramId === tgId && e.text.includes(textContains),
      );
      if (edited) return edited;
      return transport.api.sentMessages.find(
        (m) => m.telegramId === tgId && m.text.includes(textContains),
      );
    });
  }

  /** Клик по кнопке с текстом (код — отштампованный, из Api-записи). */
  function click(tgId: number, buttonText: string): Promise<unknown> {
    return transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, buttonText),
      }),
    );
  }

  /** apply-кнопка анкетного курса на открытой карточке. */
  function applyCode(tgId: number): string {
    return pressedCode(transport, tgId, 'Хочу пройти курс');
  }

  /** /start → «Курсы» → листание к анкетному курсу (уровень 0 с apply-кнопкой). */
  async function openCatalog(tgId: number): Promise<void> {
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Курсы'),
      }),
    );
    const shortId = QUESTIONNAIRE_COURSE_ID.slice(0, 8);
    while (true) {
      const screens = screensNewFirst(transport, tgId);
      const isTargetCourse = screens[0]?.keyboard?.rows
        .flat()
        .some(
          (b) =>
            b.code.includes(shortId) &&
            (b.code.includes(':phase:') ||
              b.code.includes(':apply:') ||
              b.code.includes(':cancel:')),
        );
      if (isTargetCourse) break;
      const nextBtn = screens[0]?.keyboard?.rows
        .flat()
        .find((b) => b.text.includes('След. курс'));
      if (!nextBtn) break;
      await transport.handleCallback(
        transport.makeBotContext(tgId, { callbackData: nextBtn.code }),
      );
    }
  }

  /**
   * Вход в анкету: каталог → apply → приглашение «заполнить анкету»
   * (вариант A: сервер только зовёт) → кнопка-мост → Q1.
   * Возвращает сообщение Q1 (radio, кнопки 1/2/3).
   */
  async function startQuestionnaire(tgId: number): Promise<SentMessage> {
    await openCatalog(tgId);
    await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: applyCode(tgId) }),
    );

    const invite = await waitForSent(tgId, 'Для вас подготовлена анкета');
    const fillBtn = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '▶️ Заполнить анкету');
    expect(fillBtn, 'Кнопка «▶️ Заполнить анкету» не найдена').toBeDefined();
    await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: fillBtn!.code }),
    );

    const q1 = await waitForSent(tgId, 'Вопрос 1 из 3');
    expect(q1.keyboard?.rows[0]?.map((b) => b.text)).toEqual(['1', '2', '3']);
    return q1;
  }

  // ── FR-5 (вариант A): приглашение продолжить — кнопка-мост ──

  /** Публикует событие приглашения продолжить (как SweepAbandonedJob на 3ч). */
  function publishContinueInvite(respondent: U7BotActor): void {
    app.eventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: QuestionnaireEvents.continueInvite.name,
      occurredAt: new Date().toISOString(),
      aggregateName: 'Questionnaire',
      aggregateId: QUESTIONNAIRE_COURSE_ID,
      payload: v.parse(QuestionnaireEvents.continueInvite.payload, {
        questionnaireId: QUESTIONNAIRE_COURSE_ID,
        respondentId: respondent.user.uuid,
        kind: 'standard',
        ownerInfo: { courseId: QUESTIONNAIRE_COURSE_ID },
      }),
    } as never);
  }

  test('при чужом активном флоу: приглашение без предупреждения → «Продолжить анкету» переключает диалог', async () => {
    // 1. Анкета начата (in_progress)
    await startQuestionnaire(fillGuest.user.view().telegramId);

    // 2. Сессия потеряна (рестарт бота): анкета остаётся in_progress,
    //    пользователь начинает чужой флоу (ввод кодового слова потока)
    transport.dropSession(fillGuest.user.view().telegramId);
    await transport.handleStart(
      transport.makeBotContext(fillGuest.user.view().telegramId),
    );
    await transport.handleCallback(
      transport.makeBotContext(fillGuest.user.view().telegramId, {
        callbackData: pressedCode(
          transport,
          fillGuest.user.view().telegramId,
          'Школа',
        ),
      }),
    );
    await transport.handleCallback(
      transport.makeBotContext(fillGuest.user.view().telegramId, {
        callbackData: pressedCode(
          transport,
          fillGuest.user.view().telegramId,
          'Потоки',
        ),
      }),
    );
    await transport.handleCallback(
      transport.makeBotContext(fillGuest.user.view().telegramId, {
        callbackData: pressedCode(
          transport,
          fillGuest.user.view().telegramId,
          'Поток 5',
        ),
      }),
    );
    await transport.handleCallback(
      transport.makeBotContext(fillGuest.user.view().telegramId, {
        callbackData: pressedCode(
          transport,
          fillGuest.user.view().telegramId,
          'Записаться',
        ),
      }),
    );
    await waitForScreen(fillGuest.user.view().telegramId, 'кодовое слово');
    const enrollDialog = transport.dialogOf(fillGuest.user.view().telegramId);
    expect(enrollDialog?.input).toBeDefined();
    expect(enrollDialog?.path).not.toBe('questionnaire/fill');

    // 3. Приглашение продолжить: кнопка-мост (адрес — профиль респондента)
    publishContinueInvite(fillGuest);
    const invite = await waitForSent(
      fillGuest.user.view().telegramId,
      'Вы начали заполнять анкету',
    );
    expect(invite.text).toContain('продолжим?');
    expect(invite.text).not.toContain('окончанию вашего текущего действия');
    expect(
      invite.keyboard?.rows
        .flat()
        .some((b) => b.text === '▶️ Продолжить анкету'),
    ).toBe(true);
    expect(
      invite.keyboard?.rows.flat().some((b) => b.text === '⏭️ Прервать'),
    ).toBe(true);

    // 4. Кнопка-мост: диалог switch-ится в fill, прошлый вопрос вернулся
    await transport.handleCallback(
      transport.makeBotContext(fillGuest.user.view().telegramId, {
        callbackData: pressedCode(
          transport,
          fillGuest.user.view().telegramId,
          'Продолжить анкету',
        ),
      }),
    );
    await waitForSent(fillGuest.user.view().telegramId, 'Вопрос 1 из 3');
    expect(transport.dialogOf(fillGuest.user.view().telegramId)?.path).toBe(
      'questionnaire/fill',
    );

    // 5. Анкета заполняется дальше: radio-ответ работает (вопрос → история)
    await click(fillGuest.user.view().telegramId, '2');
    await waitForSent(fillGuest.user.view().telegramId, 'Вопрос 2 из 3');
    const edit = transport.api.editedMessages.find(
      (e) =>
        e.telegramId === fillGuest.user.view().telegramId &&
        e.text.includes('Какой у тебя опыт?') &&
        e.text.includes('\\(x\\)'),
    );
    expect(edit).toBeDefined();
  });
});
