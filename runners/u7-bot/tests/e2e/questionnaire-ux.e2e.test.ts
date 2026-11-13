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
import type { DialogResponse } from '@u7-scl/core/ui';
import {
  GetQuestionnairesByUserUcDef,
  LikertQuestionPoolSchema,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  QuestionnairePoolSchema,
  SendLikertInviteUcDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
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
  stampedCode,
} from '@u7-scl/test-helpers/test-bot-transport';
import { type OperationRef, SystemCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
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
    app.eventBus.publish(
      envelopeOf(
        QuestionnaireEvents.continueInvite,
        v.parse(QuestionnaireEvents.continueInvite.payload, {
          questionnaireId: QUESTIONNAIRE_COURSE_ID,
          respondentId: respondent.user.uuid,
          kind: 'standard',
          ownerInfo: { courseId: QUESTIONNAIRE_COURSE_ID },
        }),
        {
          occurredAt: Date.now(),
          aggregateId: QUESTIONNAIRE_COURSE_ID,
        },
      ),
    );
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

// ═══ F-31: состояния анкеты, отказы и прерывание ═══
//
// Анкеты создаются настоящими UC (`startQuestionnaire`/`sendLikertInvite`):
// у каждого теста свой `courseId` или маркер владельца — состояние не делится.

const MARINA_TG = 1007;
const OLEG_TG = 1008;
const PROBE_FROM: OperationRef = {
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
};

const traceOf = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

/** Пул из трёх вопросов: радио → текст → мультивыбор. */
const uxPool = () =>
  v.parse(QuestionnairePoolSchema, {
    inviteText: 'Заполни анкету о курсе',
    completionText: 'Спасибо! Анкета принята.',
    cancelWarning: 'Прогресс анкеты будет сохранён.',
    questions: [
      {
        question: 'Какой у тебя опыт?',
        questionCode: 'q1',
        type: 'choice',
        multiple: false,
        answers: [
          { answer: 'Новичок', answerCode: 'novice' },
          { answer: 'Средний', answerCode: 'mid' },
        ],
      },
      {
        question: 'Расскажи о себе',
        questionCode: 'q2',
        type: 'text',
      },
      {
        question: 'Что интересно?',
        questionCode: 'q3',
        type: 'choice',
        multiple: true,
        answers: [
          { answer: 'Фронтенд', answerCode: 'fe' },
          { answer: 'Бэкенд', answerCode: 'be' },
        ],
      },
    ],
  });

/** Likert-пул с текстом «зачем это нужно» — приглашение S01. */
const uxLikertPool = () =>
  v.parse(LikertQuestionPoolSchema, {
    inviteText: 'Оцени коллегу',
    whyText: 'Это помогает расти',
    questions: [
      {
        questionCode: 'm1',
        question: 'Пишет код чисто',
        likertMapping: {
          category: 'professional_skills',
          subcategory: 'work_quality',
          weight: 1,
        },
      },
    ],
  });

describe('E2E анкеты: состояния и отказы (F-31)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let marina: U7BotActor;
  let oleg: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('questionnaire-ux-gaps-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new QuestionnaireController(),
    ]);
    marina = await app.userByTelegramId(MARINA_TG);
    oleg = await app.userByTelegramId(OLEG_TG);
  });

  beforeEach(() => {
    transport.reset();
    transport.dropSession(MARINA_TG);
    transport.dropSession(OLEG_TG);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  const ctx = (
    tgId: number,
    opts: { callbackData?: string; text?: string } = {},
  ) => transport.makeBotContext(tgId, opts);

  const textOf = (response: { screen?: { text: unknown } }): string =>
    String(response.screen?.text ?? '');

  const buttonsOf = (response: DialogResponse): string[] =>
    (response.screen?.keyboard?.rows.flat() ?? []).map((b) => b.text);

  async function waitForSent(
    tgId: number,
    textContains: string,
  ): Promise<SentMessage> {
    const deadline = Date.now() + 3000;
    for (;;) {
      const found = transport.api.sentMessages.find(
        (m) => m.telegramId === tgId && m.text.includes(textContains),
      );
      if (found) return found;
      if (Date.now() > deadline) {
        throw new Error(`Таймаут ожидания «${textContains}» для ${tgId}`);
      }
      await Bun.sleep(25);
    }
  }

  /** Код кнопки с точной подписью на самом свежем экране пользователя. */
  function btnCode(tgId: number, text: string): string {
    const screen = screensNewFirst(transport, tgId)[0];
    const found = screen?.keyboard?.rows.flat().find((b) => b.text === text);
    if (!found) {
      throw new Error(`Кнопка «${text}» не найдена на экране ${tgId}`);
    }
    return found.code;
  }

  const pressCode = (tgId: number, code: string) =>
    transport.handleCallback(ctx(tgId, { callbackData: code }));

  const pressButton = (tgId: number, text: string) =>
    pressCode(tgId, btnCode(tgId, text));

  /** Прямой вызов стори кнопкой с крафтовым кодом (штамп — текущего экрана). */
  const pressRaw = (tgId: number, rawCode: string) =>
    pressCode(tgId, stampedCode(transport, tgId, rawCode));

  const startMenu = (tgId: number) => transport.handleStart(ctx(tgId));

  const sendText = (tgId: number, text: string) =>
    transport.handleMessage(ctx(tgId, { text }));

  /** Настоящий `startQuestionnaire` — анкета сразу в работе, с первого вопроса. */
  async function createStandard(
    ownerInfo: Record<string, unknown>,
  ): Promise<void> {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({ pool: uxPool(), ownerInfo }),
        new SystemCaller(PROBE_FROM, marina),
        traceOf(),
      ),
    );
  }

  /** Настоящий `sendLikertInvite` — likert-анкета в статусе invited. */
  async function createLikert(
    ownerInfo: Record<string, unknown>,
    respondent: U7BotActor = marina,
  ): Promise<void> {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        SendLikertInviteUcDef.command({ pool: uxLikertPool(), ownerInfo }),
        new SystemCaller(PROBE_FROM, respondent),
        traceOf(),
      ),
    );
  }

  /** Анкеты пользователя (настоящий `getQuestionnairesByUser`). */
  async function questionnairesOf(actor: U7BotActor) {
    return expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        GetQuestionnairesByUserUcDef.command({ userId: actor.user.uuid }),
        actor,
        traceOf(),
      ),
    );
  }

  /** id анкеты по уникальному маркеру владельца. */
  async function idByMarker(
    actor: U7BotActor,
    marker: string,
  ): Promise<string> {
    const found = (await questionnairesOf(actor)).find(
      (q) => String(q.ownerInfo.marker) === marker,
    );
    if (!found) throw new Error(`Анкета с маркером ${marker} не найдена`);
    return found.uuid;
  }

  /** id активной standard-анкеты по курсу. */
  async function idByCourse(courseId: string): Promise<string> {
    const found = (await questionnairesOf(marina)).find(
      (q) => String(q.ownerInfo.courseId) === courseId,
    );
    if (!found) throw new Error(`Анкета курса ${courseId} не найдена`);
    return found.uuid;
  }

  /** /start → кнопка-мост «продолжить анкету по курсу». */
  async function resume(courseId: string) {
    await startMenu(MARINA_TG);
    return pressRaw(MARINA_TG, `questionnaire:fill:resume:${courseId}`);
  }

  // ── События и состояния ──

  test('P7-04: started без courseId — подсказка «откройте через /start» без кнопок', async () => {
    await createStandard({});

    const msg = await waitForSent(MARINA_TG, 'Для вас подготовлена анкета');

    expect(msg.text).toContain('откройте её через /start');
    expect(msg.keyboard).toBeUndefined();
  });

  test('P7-06: resume без активной анкеты — заглушка с меню, без ⚠️', async () => {
    const completedCourse = crypto.randomUUID();
    await createStandard({ courseId: completedCourse });
    await resume(completedCourse);
    await pressButton(MARINA_TG, '1');
    await sendText(MARINA_TG, 'Мой ответ');
    await pressButton(MARINA_TG, '1');
    await pressButton(MARINA_TG, 'Далее -->');

    // completed того же курса не считается активной анкетой
    const completed = await resume(completedCourse);
    expect(textOf(completed)).toContain('Анкета не найдена или уже завершена');
    expect(textOf(completed)).not.toContain('⚠️');
    expect(buttonsOf(completed)).toContain('↩️ Главное меню');

    // likert того же курса и вовсе отсутствующий курс — та же заглушка
    const likertCourse = crypto.randomUUID();
    await createLikert({ courseId: likertCourse });
    for (const courseId of [likertCourse, crypto.randomUUID()]) {
      const missing = await resume(courseId);
      expect(textOf(missing)).toContain('Анкета не найдена или уже завершена');
    }
  });

  test('P7-07: resume при сбое get-questionnaires-by-user — экран внутренней ошибки', async () => {
    const file = `${app.fixtures.dbDir}/questionnaires/questionnaires.json`;
    const original = await Bun.file(file).text();
    try {
      await Bun.write(file, '{{{ not json');
      await startMenu(MARINA_TG);

      const response = await pressRaw(
        MARINA_TG,
        `questionnaire:fill:resume:${crypto.randomUUID()}`,
      );

      expect(textOf(response)).toContain('Произошла внутренняя ошибка');
      expect(textOf(response)).not.toContain('not json');
      expect(buttonsOf(response)).toContain('⬅️ Меню');
    } finally {
      await Bun.write(file, original);
    }
  });

  // ── Приглашение S01 ──

  test('P7-21: invite:start — первый вопрос likert и захват ввода', async () => {
    await startMenu(MARINA_TG);
    await createLikert({ marker: 'gap-21' });
    const invite = await waitForSent(MARINA_TG, '📋 *Анкета*');
    const start = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '▶️ Начать заполнение');
    expect(start).toBeDefined();

    const response = await pressCode(MARINA_TG, start!.code);

    expect(textOf(response)).toContain('Пишет код чисто');
    expect(buttonsOf(response)).toEqual(['1', '2', '3', '4', '5']);
    const dialog = transport.dialogOf(MARINA_TG);
    expect(dialog?.path).toBe('questionnaire/fill');
    const context = dialog?.input?.context as
      | { questionnaireId?: string }
      | undefined;
    expect(context?.questionnaireId).toBeDefined();
  });

  test('P7-22: invite:start — не найдена и чужая анкета — экраны ошибки', async () => {
    await startMenu(MARINA_TG);
    const missing = await pressRaw(
      MARINA_TG,
      `questionnaire:invite:start:${crypto.randomUUID()}`,
    );
    expect(textOf(missing)).toContain('⚠️');
    expect(textOf(missing)).toContain('Анкета не найдена');
    expect(buttonsOf(missing)).toContain('⬅️ Меню');

    const marker = `foreign-${crypto.randomUUID()}`;
    await createLikert({ marker }, oleg);
    const qId = await idByMarker(oleg, marker);

    await startMenu(MARINA_TG);
    const foreign = await pressRaw(
      MARINA_TG,
      `questionnaire:invite:start:${qId}`,
    );

    expect(textOf(foreign)).toContain('Нет доступа к анкете');
    expect(buttonsOf(foreign)).toContain('⬅️ Меню');
  });

  test('P7-23: invite:why — текст «зачем» и «✅ Хорошо»', async () => {
    await startMenu(MARINA_TG);
    await createLikert({ marker: 'gap-23' });
    const invite = await waitForSent(MARINA_TG, '📋 *Анкета*');
    const why = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '❔ Зачем это нужно?');
    expect(why).toBeDefined();

    const response = await pressCode(MARINA_TG, why!.code);

    expect(textOf(response)).toContain('Это помогает расти');
    expect(buttonsOf(response)).toEqual(['✅ Хорошо']);
  });

  test('P7-24: «✅ Хорошо» возвращает приглашение S01 с теми же кнопками', async () => {
    await startMenu(MARINA_TG);
    await createLikert({ marker: 'gap-24' });
    const invite = await waitForSent(MARINA_TG, '📋 *Анкета*');
    const why = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '❔ Зачем это нужно?');
    await pressCode(MARINA_TG, why!.code);

    const back = await pressButton(MARINA_TG, '✅ Хорошо');

    expect(textOf(back)).toContain('📋');
    expect(textOf(back)).toContain('Оцени коллегу');
    expect(buttonsOf(back)).toEqual([
      '▶️ Начать заполнение',
      '❔ Зачем это нужно?',
      '⏭️ Пропустить',
    ]);
  });

  test('P7-25: «⏭️ Пропустить» — confirm S06a с парой кнопок', async () => {
    await startMenu(MARINA_TG);
    await createLikert({ marker: 'gap-25' });
    const invite = await waitForSent(MARINA_TG, '📋 *Анкета*');
    const decline = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '⏭️ Пропустить');

    const confirmScreen = await pressCode(MARINA_TG, decline!.code);

    expect(textOf(confirmScreen)).toContain(
      'Вы уверены, что хотите пропустить анкету?',
    );
    expect(buttonsOf(confirmScreen)).toEqual([
      '✅ Да, пропустить',
      '❌ Нет, вернуться',
    ]);
  });

  test('P7-26: «✅ Да, пропустить» — «Анкета пропущена.» и release', async () => {
    await startMenu(MARINA_TG);
    await createLikert({ marker: 'gap-26' });
    const invite = await waitForSent(MARINA_TG, '📋 *Анкета*');
    const decline = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '⏭️ Пропустить');
    await pressCode(MARINA_TG, decline!.code);

    const done = await pressButton(MARINA_TG, '✅ Да, пропустить');

    expect(textOf(done)).toContain('Анкета пропущена');
    expect(buttonsOf(done)).toContain('↩️ Главное меню');
    expect(transport.dialogOf(MARINA_TG)?.input).toBeUndefined();

    const qId = await idByMarker(marina, 'gap-26');
    const view = (await questionnairesOf(marina)).find((q) => q.uuid === qId);
    expect(view?.status).toBe('abandoned');
  });

  test('P7-27: отказ по чужой анкете — экран ошибки с выходом в меню', async () => {
    await startMenu(MARINA_TG);
    const marker = `foreign-decline-${crypto.randomUUID()}`;
    await createLikert({ marker }, oleg);
    const qId = await idByMarker(oleg, marker);

    const response = await pressRaw(
      MARINA_TG,
      `questionnaire:invite:decline:${qId}`,
    );

    expect(textOf(response)).toContain('⚠️');
    expect(textOf(response)).toContain('Нет доступа к анкете');
    expect(buttonsOf(response)).toContain('⬅️ Меню');
  });

  test('P7-28: неизвестные invite/fill-действия — «Неизвестная команда»', async () => {
    const qId = crypto.randomUUID();
    for (const raw of [
      `questionnaire:invite:bogus:${qId}`,
      `questionnaire:fill:answer:${qId}`,
      `questionnaire:fill:next:${qId}`,
      'questionnaire:fill:bogus',
    ]) {
      await startMenu(MARINA_TG);
      const response = await pressRaw(MARINA_TG, raw);
      expect(textOf(response)).toContain('Неизвестная команда');
    }
  });

  // ── Ответы и отказы движка ──

  test('P7-36: кнопка прошлого вопроса — warn, экран и ввод не тронуты', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);
    const oldAnswer = btnCode(MARINA_TG, '2');
    await pressButton(MARINA_TG, '1');

    const stale = await pressCode(MARINA_TG, oldAnswer);

    expect(stale.notify?.kind).toBe('warn');
    expect(String(stale.notify?.text)).toContain(
      'Эта кнопка относится к предыдущему вопросу',
    );
    expect(stale.screen).toBeUndefined();
    expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();
    // warn-реплика — отдельное сообщение, экран под ней не перерисован:
    // следующий за репликой экран — всё ещё текст второго вопроса
    expect(screensNewFirst(transport, MARINA_TG)[1]?.text).toContain(
      'Расскажи о себе',
    );
  });

  test('P7-37: «Далее» без выбранных — warn «Сначала выбери хотя бы один вариант»', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);
    await pressButton(MARINA_TG, '1');
    const q3 = await sendText(MARINA_TG, 'Мой ответ');
    expect(textOf(q3)).toContain('Что интересно');
    await pressButton(MARINA_TG, '1');
    const nextCode = btnCode(MARINA_TG, 'Далее -->');
    await pressButton(MARINA_TG, '1');

    const stale = await pressCode(MARINA_TG, nextCode);

    expect(stale.notify?.kind).toBe('warn');
    expect(String(stale.notify?.text)).toContain(
      'Сначала выбери хотя бы один вариант',
    );
    expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();
  });

  test('P7-38: текст на вопросе с выбором — warn «Ошибка валидации», ввод живёт', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);

    const rejected = await sendText(MARINA_TG, 'свободный ответ');

    expect(rejected.notify?.kind).toBe('warn');
    expect(String(rejected.notify?.text)).toContain('Ошибка валидации');
    expect(String(rejected.notify?.text)).toContain('Ожидался ответ с выбором');
    expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();
  });

  test('P7-39: сбой handle-action — warn без деталей, ввод сохраняется', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);
    const answer = btnCode(MARINA_TG, '1');

    const file = `${app.fixtures.dbDir}/questionnaires/questionnaires.json`;
    const original = await Bun.file(file).text();
    try {
      await Bun.write(file, '{{{ not json');

      const failed = await pressCode(MARINA_TG, answer);

      expect(failed.notify?.kind).toBe('warn');
      expect(String(failed.notify?.text)).toContain('Произошла ошибка');
      expect(String(failed.notify?.text)).not.toContain('not json');
      expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();
    } finally {
      await Bun.write(file, original);
    }
  });

  // P7-40 (документ/фото/голос вместо текста) — ветка стори недостижима:
  // бот подписан только на `message:text` (P1-33), нетекстовый апдейт
  // до `FillStory.handleMessage` не доходит.
  // P7-41 (текст без контекста анкеты) — ветка стори недостижима: ввод
  // приходит только в активный `awaitInput`, а его контекст всегда несёт
  // `questionnaireId`; fill-диалог без него e2e-сценарием не собрать.

  // ── /cancel и прерывание ──

  test('P7-43: /cancel при недоступном get-current — «Отменено», без confirm', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);

    const file = `${app.fixtures.dbDir}/questionnaires/questionnaires.json`;
    const original = await Bun.file(file).text();
    try {
      await Bun.write(file, '{{{ not json');

      const response = await transport.handleCancel(ctx(MARINA_TG));

      expect(String(response.notify?.text)).toContain('Отменено');
      expect(String(response.notify?.text)).toContain('Наберите /start');
      expect(textOf(response)).not.toContain('Вы уверены');
    } finally {
      await Bun.write(file, original);
    }
  });

  test('P7-44: /cancel без активного fill-диалога — меню, анкета не тронута', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await startMenu(MARINA_TG);

    const response = await transport.handleCancel(ctx(MARINA_TG));

    expect(buttonsOf(response)).toContain('❓ Помощь');
    expect(textOf(response)).not.toContain('Вы уверены');
    expect(transport.dialogOf(MARINA_TG)?.path).toBe('app/menu');
    const qId = await idByCourse(courseId);
    const view = (await questionnairesOf(marina)).find((q) => q.uuid === qId);
    expect(view?.status).toBe('in_progress');
  });

  test('P7-46: «❌ Нет, продолжить» — текущий вопрос снова с захватом ввода', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    await resume(courseId);

    const confirmScreen = await transport.handleCancel(ctx(MARINA_TG));
    expect(textOf(confirmScreen)).toContain(
      'Вы уверены, что хотите прервать анкету',
    );

    const back = await pressButton(MARINA_TG, '❌ Нет, продолжить');

    expect(textOf(back)).toContain('Какой у тебя опыт');
    const dialog = transport.dialogOf(MARINA_TG);
    expect(dialog?.path).toBe('questionnaire/fill');
    expect(dialog?.input).toBeDefined();
  });

  test('P7-47: fill:current и fill:cancel-confirm по чужой анкете — экран ошибки', async () => {
    const marker = `foreign-fill-${crypto.randomUUID()}`;
    await createLikert({ marker }, oleg);
    const qId = await idByMarker(oleg, marker);

    await startMenu(MARINA_TG);
    const current = await pressRaw(
      MARINA_TG,
      `questionnaire:fill:current:${qId}`,
    );
    expect(textOf(current)).toContain('Нет доступа к анкете');

    await startMenu(MARINA_TG);
    const confirmScreen = await pressRaw(
      MARINA_TG,
      `questionnaire:fill:cancel-confirm:${qId}`,
    );
    expect(textOf(confirmScreen)).toContain('⚠️');
    expect(buttonsOf(confirmScreen)).toContain('⬅️ Меню');
  });

  test('P7-48: «⏭️ Прервать» из напоминания — confirm S05a', async () => {
    const courseId = crypto.randomUUID();
    await createStandard({ courseId });
    const qId = await idByCourse(courseId);
    await startMenu(MARINA_TG);

    app.eventBus.publish(
      envelopeOf(
        QuestionnaireEvents.continueInvite,
        v.parse(QuestionnaireEvents.continueInvite.payload, {
          questionnaireId: qId,
          respondentId: marina.user.uuid,
          kind: 'standard',
          ownerInfo: { courseId },
        }) as never,
        { occurredAt: Date.now(), aggregateId: qId },
      ),
    );
    const note = await waitForSent(MARINA_TG, 'продолжим?');
    const abort = note.keyboard?.rows
      .flat()
      .find((b) => b.text === '⏭️ Прервать');
    expect(abort).toBeDefined();

    const confirmScreen = await pressCode(MARINA_TG, abort!.code);

    expect(textOf(confirmScreen)).toContain(
      'Вы уверены, что хотите прервать анкету',
    );
    expect(buttonsOf(confirmScreen)).toEqual([
      '✅ Да, прервать',
      '❌ Нет, продолжить',
    ]);
  });
});
