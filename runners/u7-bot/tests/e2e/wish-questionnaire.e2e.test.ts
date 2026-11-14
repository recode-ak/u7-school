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
import { LearningController } from '@u7-scl/bot/learning/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import {
  GetQuestionnairesByUserUcDef,
  QuestionnaireModuleDef,
  type QuestionnaireView,
} from '@u7-scl/domain/questionnaire/contract';
import { StreamEvents, StudentEvents } from '@u7-scl/domain/stream/contract';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import type { WishStatus } from '@u7-scl/domain/wish/testing';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import { Screen } from '@u7-scl/test-helpers/screen';
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
import type { AnyEventDef } from 'dmg-core';
import { expectOk, testTrace } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

/**
 * E2E тест wish-флоу (ветка B — анкетная):
 *   apply → приглашение «заполнить анкету» (вариант A) → анкета (FillStory)
 *   → ответы → ER confirm/abandon → W04/W05
 *
 * Полный контур: CoursesController + QuestionnaireController + общая с apiApp
 * шина событий. Экраны ассертятся по DialogResponse (захват на границе uiApp)
 * и Api-записям; статусы желаний — по фактическому содержимому wishRepo.
 */

// Фикстурный курс с опасным названием и малым пулом анкеты (3 вопроса)
const QUESTIONNAIRE_COURSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** Курсы и модули мира `core-education`, нужные веткам желаний. */
const COURSE_JS_BASICS = 'fafafafa-baba-4aba-8aba-babababababa';
const COURSE_ALGORITHMS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MODULE_JS_SYNTAX = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
const MODULE_ALGORITHMS = 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const MODULE_UX_RESEARCH = 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2';
const STREAM_ENROLLMENT = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
const UNKNOWN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** Пользователи мира `core-education` (uuid фикстур). */
const USER_GUEST = '11111111-1111-1111-1111-111111111111';
const USER_CANDIDATE = '22222222-2222-2222-2222-222222222222';
const USER_ANDREY = '33333333-3333-3333-3333-333333333333';
const USER_DEV = '44444444-4444-4444-4444-444444444444';
const USER_MARINA = '77777777-7777-4777-8777-777777777777';
const USER_OLEG = '88888888-8888-4888-8888-888888888888';
/** Желание без профиля: такого пользователя в мире нет. */
const USER_WITHOUT_PROFILE = 'abababab-abab-4bab-8bab-abababababab';

const WISH_CREATED_AT = Date.UTC(2026, 8, 20, 12, 0, 0);

/**
 * Мир веток желаний: `core-education` с желаниями во всех статусах.
 *
 * - Марина: `pending` на анкетный курс (карточка → «Продолжить анкету»);
 * - Олег: `expressed`/Гость: `confirmed` на «Основы программирования»;
 * - Андрей: желание на модуль (кнопка из уведомления → «уже записан»);
 * - Кандидат: желание на модуль для отмены (W05-M);
 * - без профиля: желание на курс с несуществующим пользователем.
 */
const WISH_FLOWS_WORLD: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'wish-flows',
  description:
    'core-education с желаниями: pending, expressed, confirmed, желание на модуль',
  wishes: [
    {
      uuid: 'aa000001-0000-4000-8000-000000000001',
      userId: USER_MARINA,
      target: { kind: 'course', courseId: QUESTIONNAIRE_COURSE_ID },
      status: 'pending',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000002-0000-4000-8000-000000000002',
      userId: USER_MARINA,
      target: { kind: 'course', courseId: COURSE_JS_BASICS },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000003-0000-4000-8000-000000000003',
      userId: USER_MARINA,
      target: { kind: 'course', courseId: COURSE_ALGORITHMS },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000004-0000-4000-8000-000000000004',
      userId: USER_OLEG,
      target: { kind: 'course', courseId: COURSE_JS_BASICS },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000005-0000-4000-8000-000000000005',
      userId: USER_GUEST,
      target: { kind: 'course', courseId: COURSE_JS_BASICS },
      status: 'confirmed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000006-0000-4000-8000-000000000006',
      userId: USER_ANDREY,
      target: { kind: 'module', moduleId: MODULE_UX_RESEARCH },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000007-0000-4000-8000-000000000007',
      userId: USER_CANDIDATE,
      target: { kind: 'module', moduleId: MODULE_UX_RESEARCH },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000009-0000-4000-8000-000000000009',
      userId: USER_CANDIDATE,
      target: { kind: 'course', courseId: COURSE_JS_BASICS },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
    {
      uuid: 'aa000008-0000-4000-8000-000000000008',
      userId: USER_WITHOUT_PROFILE,
      target: { kind: 'course', courseId: COURSE_JS_BASICS },
      status: 'expressed',
      createdAt: WISH_CREATED_AT,
      updatedAt: WISH_CREATED_AT,
      version: 0,
    },
  ],
};

describe('Wish: анкетная ветка (e2e)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;
  let candidate: U7BotActor;
  let student: U7BotActor;
  let mentor: U7BotActor;
  let admin: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('wish-questionnaire-e2e');
    const courseController = new CoursesController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    const questionnaireController = new QuestionnaireController();
    transport = createTestBotTransport(app, [
      appController,
      courseController,
      questionnaireController,
    ]);
    guest = await app.userByTelegramId(1001);
    candidate = await app.userByTelegramId(1002);
    student = await app.userByTelegramId(1003);
    mentor = await app.userByTelegramId(1004);
    admin = await app.userByTelegramId(1005);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  /**
   * Ожидает, пока probe не вернёт значение. Приглашения FillStory
   * и ER-реакции доставляются асинхронно (fire-and-forget eventBus) —
   * ждём poll'ом с таймаутом, а не «сном наугад».
   */
  async function waitFor<T>(
    what: string,
    probe: () => T | undefined | Promise<T | undefined>,
    timeoutMs = 3000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = await probe();
      if (found !== undefined) return found;
      if (Date.now() > deadline) {
        throw new Error(`Таймаут ожидания: ${what}`);
      }
      await Bun.sleep(25);
    }
  }

  /** Сообщение пользователю с подстрокой в тексте (канал приглашений). */
  function waitForSent(
    tgId: number,
    textContains: string,
  ): Promise<SentMessage> {
    return waitFor(`сообщение «${textContains}» для ${tgId}`, () =>
      transport.api.sentMessages.find(
        (m) => m.telegramId === tgId && m.text.includes(textContains),
      ),
    );
  }

  /** Статус желания пользователя на курс (по репозиторию). */
  async function wishStatuses(
    user: U7BotActor,
    courseId: string,
  ): Promise<WishStatus[]> {
    return (
      await app.wishRepo.findAllByUserAndTarget(user.user.uuid, {
        kind: 'course',
        courseId,
      })
    ).map((w) => w.snapshot().status);
  }

  /** Ожидает появления статуса желания в репозитории (асинхронная ER). */
  function waitForWishStatus(
    user: U7BotActor,
    courseId: string,
    status: WishStatus,
  ): Promise<WishStatus> {
    return waitFor(`статус желания ${status}`, async () =>
      (await wishStatuses(user, courseId)).includes(status)
        ? status
        : undefined,
    );
  }

  /** Статус standard-анкеты пользователя по курсу (по UC модуля). */
  async function questionnaireStatus(
    user: U7BotActor,
    courseId: string,
  ): Promise<QuestionnaireView['status'] | undefined> {
    const states = expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        GetQuestionnairesByUserUcDef.command({ userId: user.user.uuid }),
        user,
        testTrace(),
      ),
    );
    return states.find(
      (s) => s.kind === 'standard' && s.ownerInfo.courseId === courseId,
    )?.status;
  }

  /**
   * Сбрасывает сессию пользователя — эмуляция перезапуска бота
   * (сессии хранятся в памяти процесса).
   */
  function dropSession(tgId: number): void {
    transport.dropSession(tgId);
  }

  /** Клик по кнопке с текстом (код — отштампованный, из Api-записи). */
  function click(tgId: number, buttonText: string) {
    return transport.press(tgId, buttonText);
  }

  /** apply-кнопка анкетного курса на открытой карточке. */
  function applyCode(tgId: number): string {
    return pressedCode(transport, tgId, 'Хочу пройти курс');
  }

  /** /start → «Курсы» → листание к анкетному курсу (уровень 0 с apply-кнопкой). */
  async function openCatalog(tgId: number): Promise<void> {
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.press(tgId, 'Курсы');
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

  /** apply (кнопка «Хочу пройти курс» в каталоге). */
  function applyQuestionnaire(tgId: number) {
    return transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: applyCode(tgId) }),
    );
  }

  /** Контекст анкеты активного ввода (questionnaireId). */
  function fillContext(tgId: number): { questionnaireId?: string } | undefined {
    return transport.dialogOf(tgId)?.input?.context as
      | { questionnaireId?: string }
      | undefined;
  }

  /**
   * Вход в анкету: каталог → apply → приглашение «заполнить анкету»
   * (вариант A) → кнопка-мост → Q1. Возвращает сообщение Q1.
   */
  async function startQuestionnaire(tgId: number): Promise<SentMessage> {
    await openCatalog(tgId);
    await applyQuestionnaire(tgId);
    const invite = await waitForSent(tgId, 'Для вас подготовлена анкета');
    const fillBtn = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '▶️ Заполнить анкету');
    expect(fillBtn, 'Кнопка «▶️ Заполнить анкету» не найдена').toBeDefined();
    await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: fillBtn!.code }),
    );
    return waitForSent(tgId, 'Вопрос 1 из 3');
  }

  // ── B.1: apply → приглашение (вариант A) → вход кнопкой-мостом ──

  test('apply анкетного курса → приглашение «заполнить анкету» → кнопка-мост → Q1, желание pending', async () => {
    const response = await (async () => {
      await openCatalog(guest.user.view().telegramId);
      return applyQuestionnaire(guest.user.view().telegramId);
    })();
    // Анкетная ветка: стори ничего не шлёт — только событие start
    expect(response.screen).toBeUndefined();

    // Приглашение (вариант A): сервер только зовёт, диалог открывает
    // пользователь
    const invite = await waitForSent(
      guest.user.view().telegramId,
      'Для вас подготовлена анкета',
    );
    expect(invite.text).toContain('заполните, пожалуйста');
    expect(invite.keyboard?.rows.flat().map((b) => b.text)).toEqual([
      '▶️ Заполнить анкету',
    ]);

    // Кнопка-мост открывает анкету: Q1 с подсказкой /cancel
    const q1 = await startQuestionnaireContinue(
      guest.user.view().telegramId,
      invite,
    );
    expect(q1.text).toContain('Какой у тебя опыт?');
    expect(q1.text).toContain('/cancel');
    // single-choice: кнопки-варианты «1»…«3»
    expect(q1.keyboard?.rows[0]?.map((b) => b.text)).toEqual(['1', '2', '3']);

    // Сессия: захват ввода fill-диалогом с questionnaireId в контексте
    expect(transport.dialogOf(guest.user.view().telegramId)?.path).toBe(
      'questionnaire/fill',
    );
    expect(
      fillContext(guest.user.view().telegramId)?.questionnaireId,
    ).toBeDefined();

    // Анкетная ветка создаёт желание в pending (по репозиторию)
    expect(
      await waitForWishStatus(guest, QUESTIONNAIRE_COURSE_ID, 'pending'),
    ).toBe('pending');
  });

  /** Продолжение входа: клик по кнопке приглашения из B.1. */
  async function startQuestionnaireContinue(
    tgId: number,
    invite: SentMessage,
  ): Promise<SentMessage> {
    const fillBtn = invite.keyboard?.rows
      .flat()
      .find((b) => b.text === '▶️ Заполнить анкету')!;
    await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: fillBtn.code }),
    );
    return waitForSent(tgId, 'Вопрос 1 из 3');
  }

  // ── B.2: «Вопрос 2 из 3» без подсказки + опасный текст-ответ ──

  test('выбор в вопросе 1 → текстовый «Вопрос 2 из 3» без подсказки; опасный ответ не ломает бота', async () => {
    await startQuestionnaire(candidate.user.view().telegramId);
    const q1 = await waitForSent(
      candidate.user.view().telegramId,
      'Вопрос 1 из 3',
    );

    // Выбор «1» (Новичок) → текстовый вопрос 2
    const q2 = await click(candidate.user.view().telegramId, '2');
    expect(q2.screen?.text).toContain('Вопрос 2 из 3');
    expect(q2.screen?.text).toContain('Опиши свою цель');
    // Подсказка про /cancel — только на первом вопросе
    expect(q2.screen?.text).not.toContain('/cancel');
    // text-вопрос рендерится без клавиатуры (ввод с клавиатуры)
    expect(q2.screen?.keyboard).toBeUndefined();

    // Опасный ответ (спецсимволы MarkdownV2) — бот не падает:
    // битый md не ушёл бы в Telegram (fail-fast транспорта), Q3 не пришёл бы
    const q3 = await transport.handleMessage(
      transport.makeBotContext(candidate.user.view().telegramId, {
        text: 'Да. Конечно - (тест) #1! +2=2',
      }),
    );
    expect(q3.screen?.text).toContain('Вопрос 3 из 3');
    expect(q3.screen?.text).toContain('Как удобнее учиться');
    await waitForSent(candidate.user.view().telegramId, 'Вопрос 3 из 3');
  });

  // ── B.3: /cancel посреди анкеты → abandoned (ER abandon-wish) ──

  test('/cancel посреди анкеты → подтверждение → анкета и желание abandoned', async () => {
    await startQuestionnaire(student.user.view().telegramId);
    await waitForSent(student.user.view().telegramId, 'Вопрос 1 из 3');

    // /cancel при активной анкете — экран подтверждения с cancelWarning из пула
    const confirmScreen = await transport.handleCancel(
      transport.makeBotContext(student.user.view().telegramId),
    );
    expect(confirmScreen.screen?.text).toContain('хотите прервать анкету');
    expect(confirmScreen.screen?.text).toContain('начать заново');
    // Анкета ещё не брошена
    expect(await questionnaireStatus(student, QUESTIONNAIRE_COURSE_ID)).toBe(
      'in_progress',
    );

    // «✅ Да, прервать» → abandon UC + ER abandon-wish
    const done = await click(student.user.view().telegramId, '✅ Да, прервать');
    expect(done.screen?.text).toContain('Анкета прервана');
    expect(done.release).toBe(true);
    expect(
      transport.dialogOf(student.user.view().telegramId)?.input,
    ).toBeUndefined();

    // ER: желание pending → abandoned (по репозиторию)
    expect(
      await waitForWishStatus(student, QUESTIONNAIRE_COURSE_ID, 'abandoned'),
    ).toBe('abandoned');
    expect(await questionnaireStatus(student, QUESTIONNAIRE_COURSE_ID)).toBe(
      'abandoned',
    );
  });

  // ── B.4: apply при незавершённой анкете → W04 pending → resume ──

  test('повторный apply при незавершённой анкете → W04 pending → «Продолжить анкету» → тот же вопрос', async () => {
    await startQuestionnaire(mentor.user.view().telegramId);
    await waitForSent(mentor.user.view().telegramId, 'Вопрос 1 из 3');

    // Сессия потеряна (рестарт бота) — повторный apply доходит до UC:
    // активное желание pending → конфликт → W04 «начал заполнять анкету»
    dropSession(mentor.user.view().telegramId);
    await openCatalog(mentor.user.view().telegramId);
    const w04 = await transport.pressRaw(
      mentor.user.view().telegramId,
      `course:course-catalog:apply:${QUESTIONNAIRE_COURSE_ID}`,
    );
    expect(w04.screen?.text).toContain('начал заполнять анкету');
    expect(w04.screen?.text).not.toContain('⚠️');

    // «Продолжить анкету» → resume → текущий (первый) вопрос
    const resume = await click(
      mentor.user.view().telegramId,
      'Продолжить анкету',
    );
    expect(resume.screen?.text).toContain('Вопрос 1 из 3');
    expect(resume.screen?.text).toContain('Какой у тебя опыт?');
    // Сессия восстановлена: захват ввода fill-диалогом
    expect(transport.dialogOf(mentor.user.view().telegramId)?.path).toBe(
      'questionnaire/fill',
    );
    expect(
      fillContext(mentor.user.view().telegramId)?.questionnaireId,
    ).toBeDefined();
  });

  // ── B.5: полное прохождение → completed, желание confirmed (ER) ──

  test('полное прохождение: 3 вопроса → completed-экран, желание confirmed', async () => {
    // Вход в анкету: apply → приглашение → Q1
    await startQuestionnaire(admin.user.view().telegramId);
    const resume = await waitForSent(
      admin.user.view().telegramId,
      'Вопрос 1 из 3',
    );

    // В1 (single choice): «Средний» → В2
    const q2 = await click(admin.user.view().telegramId, '2');
    expect(q2.screen?.text).toContain('Вопрос 2 из 3');

    // В2 (text): свободный ответ → В3
    const q3 = await transport.handleMessage(
      transport.makeBotContext(admin.user.view().telegramId, {
        text: 'Хочу стать разработчиком',
      }),
    );
    expect(q3.screen?.text).toContain('Вопрос 3 из 3');

    // В3 (multiple): отметить оба варианта
    const sel1 = await click(admin.user.view().telegramId, '1');
    expect(sel1.screen?.text).toContain('\\[x\\]');
    const sel2 = await click(admin.user.view().telegramId, '2');
    expect(sel2.screen?.text).toContain('\\[x\\]');
    expect(sel2.screen?.keyboard?.rows.flat().some((b) => b.text === '1')).toBe(
      true,
    );

    // «Далее -->» → completed: шапка S04 + completionText из пула
    const done = await click(admin.user.view().telegramId, 'Далее -->');
    expect(done.screen?.text).toContain('Анкета завершена');
    expect(done.screen?.text).toContain('Желание пройти курс закреплено');
    expect(done.release).toBe(true);

    // ER confirm-wish: желание pending → confirmed (по репозиторию)
    expect(
      await waitForWishStatus(admin, QUESTIONNAIRE_COURSE_ID, 'confirmed'),
    ).toBe('confirmed');
    expect(await questionnaireStatus(admin, QUESTIONNAIRE_COURSE_ID)).toBe(
      'completed',
    );
  });
});

/**
 * E2E веток желаний вне анкеты: карточка курса по статусу желания, отмена
 * курса и модуля (W05/W05-M), запись на модуль из уведомления о завершении,
 * уведомление менторам о подтверждении, реализация желаний зачислением и
 * приглашение на открывшийся набор (ER `fulfill-wish` / `invite-wishers`).
 *
 * Мир — `core-education` с желаниями во всех статусах (`WISH_FLOWS_WORLD`).
 */
describe('Wish: карточка курса, модуль и события (e2e)', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('wish-flows-e2e', WISH_FLOWS_WORLD);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
      new LearningController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  /** Текст экрана ответа (пустая строка, если экрана не было). */
  function screenText(response: DialogResponse): string {
    return String(response.screen?.text ?? '');
  }

  /** /start → карточка курса по адресу (каталог листать не нужно). */
  async function openCourseCard(
    tgId: number,
    courseId: string,
  ): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    return transport.pressRaw(tgId, `course:course-catalog:course:${courseId}`);
  }

  /** Ожидает проактивное сообщение адресату (poll по Api-записям). */
  async function waitForSentTo(
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

  /** Статусы желаний пользователя на курс (по репозиторию). */
  async function courseWishStatuses(
    userId: string,
    courseId: string,
  ): Promise<WishStatus[]> {
    return (
      await app.wishRepo.findAllByUserAndTarget(userId, {
        kind: 'course',
        courseId,
      })
    ).map((w) => w.snapshot().status);
  }

  /** Статусы желаний пользователя на модуль (по репозиторию). */
  async function moduleWishStatuses(
    userId: string,
    moduleId: string,
  ): Promise<WishStatus[]> {
    return (
      await app.wishRepo.findAllByUserAndTarget(userId, {
        kind: 'module',
        moduleId,
      })
    ).map((w) => w.snapshot().status);
  }

  /** Публикует Def-событие под FQN (payload валидируется схемой). */
  function publish<E extends AnyEventDef>(
    event: E,
    payload: v.InferInput<E['payload']>,
  ): void {
    app.eventBus.publish(
      envelopeOf(event, v.parse(event.payload, payload) as never, {
        occurredAt: Date.now(),
        aggregateId: crypto.randomUUID(),
      }),
    );
  }

  // ── Карточка курса по статусу желания ──

  test('P2-40: карточка курса с pending-желанием — «📝 Продолжить анкету»', async () => {
    const response = await openCourseCard(1007, QUESTIONNAIRE_COURSE_ID);

    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Продолжить анкету'),
    );
    expect(
      Screen.of(response)
        .codes()
        .some((code) =>
          code.startsWith(
            `questionnaire:fill:resume:${QUESTIONNAIRE_COURSE_ID}`,
          ),
        ),
    ).toBe(true);
  });

  test('P2-41 / P7-63: карточка курса с expressed/confirmed-желанием — «🗑️ Отменить желание»', async () => {
    const expressed = await openCourseCard(1008, COURSE_JS_BASICS);
    expect(Screen.of(expressed).texts()).toContainEqual(
      expect.stringContaining('Отменить желание'),
    );
    expect(
      Screen.of(expressed)
        .codes()
        .some((code) =>
          code.startsWith(`course:course-catalog:cancel:${COURSE_JS_BASICS}`),
        ),
    ).toBe(true);

    const confirmed = await openCourseCard(1001, COURSE_JS_BASICS);
    expect(Screen.of(confirmed).texts()).toContainEqual(
      expect.stringContaining('Отменить желание'),
    );
    expect(
      Screen.of(confirmed)
        .codes()
        .some((code) =>
          code.startsWith(`course:course-catalog:cancel:${COURSE_JS_BASICS}`),
        ),
    ).toBe(true);
  });

  test('P2-45: повторный apply при expressed — «уже выразил желание» и кнопки отмены', async () => {
    await openCourseCard(1008, COURSE_JS_BASICS);
    const response = await transport.pressRaw(
      1008,
      `course:course-catalog:apply:${COURSE_JS_BASICS}`,
    );

    expect(screenText(response)).toContain('Ты уже выразил желание');
    const texts = Screen.of(response).texts();
    expect(texts).toContainEqual(expect.stringContaining('Отменить желание'));
    expect(texts).toContainEqual(expect.stringContaining('Главное меню'));
  });

  test('P2-46: повторный apply при confirmed — «уже обучаешься на этом курсе»', async () => {
    await openCourseCard(1001, COURSE_JS_BASICS);
    const response = await transport.pressRaw(
      1001,
      `course:course-catalog:apply:${COURSE_JS_BASICS}`,
    );

    expect(screenText(response)).toContain('уже обучаешься на этом курсе');
    const texts = Screen.of(response).texts();
    expect(texts).toContainEqual(expect.stringContaining('Отменить желание'));
    expect(texts).toContainEqual(expect.stringContaining('Главное меню'));
  });

  test('P2-47: apply без courseId — «⚠️ Курс не указан»', async () => {
    await transport.handleStart(transport.makeBotContext(1008));
    const response = await transport.pressRaw(
      1008,
      'course:course-catalog:apply',
    );

    expect(screenText(response)).toContain('Курс не указан');
  });

  test('P2-48: apply с неизвестным курсом — warn-реплика без экрана', async () => {
    await openCourseCard(1008, COURSE_JS_BASICS);
    const response = await transport.pressRaw(
      1008,
      `course:course-catalog:apply:${UNKNOWN_ID}`,
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Курс не найден');
  });

  test('P2-51: cancel-confirm без желания — мягкое «уже нет» без ⚠️', async () => {
    await openCourseCard(1008, COURSE_ALGORITHMS);
    const response = await transport.pressRaw(
      1008,
      `course:course-catalog:cancel-confirm:${COURSE_ALGORITHMS}`,
    );

    const text = screenText(response);
    expect(text).toContain('Активного желания на этот курс уже нет');
    expect(response.notify).toBeUndefined();
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
  });

  test('P2-52: cancel-confirm с битым адресом — warn-реплика', async () => {
    await openCourseCard(1008, COURSE_ALGORITHMS);
    const response = await transport.pressRaw(
      1008,
      'course:course-catalog:cancel-confirm:not-a-uuid',
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Ошибка валидации');
  });

  // ── Запись на модуль из уведомления о завершении ──

  test('P2-53: «➡️ Следующий модуль» из приглашения — «Записали» без открытого бота', async () => {
    // Сессия потеряна (рестарт бота): диалога нет, приглашение его создаёт
    transport.dropSession(1003);
    expect(transport.dialogOf(1003)).toBeUndefined();

    publish(StudentEvents.completed, {
      studentId: 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
      userId: USER_ANDREY,
      streamId: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
      moduleId: MODULE_JS_SYNTAX,
      outcome: 'advanced',
    });

    const invite = await waitForSentTo(1003, 'Хочешь записаться');
    const next = invite.keyboard?.rows.flat()[0];
    expect(next?.text).toBe('➡️ Следующий модуль');

    // Нажатие кнопки канала invite — без /start
    const response = await transport.handleCallback(
      transport.makeBotContext(1003, { callbackData: next!.code }),
    );

    expect(screenText(response)).toContain('Записали');
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
    expect(await moduleWishStatuses(USER_ANDREY, MODULE_ALGORITHMS)).toEqual([
      'expressed',
    ]);
  });

  test('P2-54: та же кнопка, желание на модуль уже есть — «уже записан»', async () => {
    await transport.handleStart(transport.makeBotContext(1003));
    const response = await transport.pressRaw(
      1003,
      `course:course-catalog:wish:${MODULE_UX_RESEARCH}`,
    );

    expect(screenText(response)).toContain('уже записан на этот модуль');
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
  });

  test('P2-55: та же кнопка, неизвестный модуль — warn-реплика', async () => {
    await transport.handleStart(transport.makeBotContext(1003));
    const response = await transport.pressRaw(
      1003,
      `course:course-catalog:wish:${UNKNOWN_ID}`,
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Модуль не найден');
  });

  // ── Отмена желания на модуль (W05-M) ──

  test('P2-56: «🗑️ Отменить желание» модуля — подтверждение, «❌ Отмена» в меню', async () => {
    await transport.handleStart(transport.makeBotContext(1002));
    const confirm = await transport.pressRaw(
      1002,
      `course:course-catalog:cancel-mod:${MODULE_UX_RESEARCH}`,
    );

    expect(screenText(confirm)).toContain('Отменить желание пройти модуль');
    const texts = Screen.of(confirm).texts();
    expect(texts).toContainEqual(expect.stringContaining('Да'));
    expect(texts).toContainEqual(expect.stringContaining('Отмена'));

    const cancelled = await transport.press(1002, 'Отмена');
    expect(screenText(cancelled)).toContain('Главное меню');
    // Отмена подтверждения желание не трогает
    expect(
      await moduleWishStatuses(USER_CANDIDATE, MODULE_UX_RESEARCH),
    ).toEqual(['expressed']);
  });

  test('P2-57: «✅ Да» — «Желание пройти модуль отменено» и главное меню', async () => {
    await transport.handleStart(transport.makeBotContext(1002));
    const response = await transport.pressRaw(
      1002,
      `course:course-catalog:cancel-mod-confirm:${MODULE_UX_RESEARCH}`,
    );

    expect(screenText(response)).toContain('Желание пройти модуль отменено');
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
    expect(
      await moduleWishStatuses(USER_CANDIDATE, MODULE_UX_RESEARCH),
    ).toEqual(['cancelled']);
  });

  test('P2-58: cancel-mod-confirm без желания — «Активного желания на этот модуль уже нет»', async () => {
    await transport.handleStart(transport.makeBotContext(1001));
    const response = await transport.pressRaw(
      1001,
      `course:course-catalog:cancel-mod-confirm:${MODULE_ALGORITHMS}`,
    );

    expect(screenText(response)).toContain(
      'Активного желания на этот модуль уже нет',
    );
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
  });

  test('P2-59: cancel-mod-confirm с битым адресом — warn-реплика', async () => {
    await transport.handleStart(transport.makeBotContext(1001));
    const response = await transport.pressRaw(
      1001,
      'course:course-catalog:cancel-mod-confirm:not-a-uuid',
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Ошибка валидации');
  });

  // ── События: подтверждение, зачисление, открытие набора ──

  test('P7-56: wish.confirmed — notify каждому ментору, автор пропускается', async () => {
    publish(WishEvents.confirmed, {
      userId: USER_MARINA,
      courseId: COURSE_JS_BASICS,
    });

    const notified = await waitForSentTo(1004, 'подтвердил желание');
    expect(notified.text).toContain('Марина');
    expect(notified.text).toContain('Основы программирования');

    // Автор желания (сам ментор курса) уведомления не получает
    transport.reset();
    publish(WishEvents.confirmed, {
      userId: USER_DEV,
      courseId: COURSE_JS_BASICS,
    });
    await Bun.sleep(200);
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P7-58: student.enrolled — fulfill только совпадающих по модулю желаний', async () => {
    publish(StudentEvents.enrolled, {
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      userId: USER_MARINA,
      streamId: STREAM_ENROLLMENT,
      moduleId: MODULE_JS_SYNTAX,
    });

    const deadline = Date.now() + 3000;
    while (
      !(await courseWishStatuses(USER_MARINA, COURSE_JS_BASICS)).includes(
        'fulfilled',
      )
    ) {
      if (Date.now() > deadline) {
        throw new Error('Таймаут ожидания статуса fulfilled');
      }
      await Bun.sleep(25);
    }

    expect(await courseWishStatuses(USER_MARINA, COURSE_JS_BASICS)).toEqual([
      'fulfilled',
    ]);
    // Модуль другого курса и незавершённая анкета — не тронуты
    expect(await courseWishStatuses(USER_MARINA, COURSE_ALGORITHMS)).toEqual([
      'expressed',
    ]);
    expect(
      await courseWishStatuses(USER_MARINA, QUESTIONNAIRE_COURSE_ID),
    ).toEqual(['pending']);
  });

  test('P7-60: stream.created — без адреса warn и пропуск, нет потока/модуль вне программ — тишина', async () => {
    publish(StreamEvents.created, {
      streamId: STREAM_ENROLLMENT,
      moduleId: MODULE_JS_SYNTAX,
    });

    // Желающие с адресом приглашены, желание без профиля пропущено
    const toGuest = await waitForSentTo(1001, 'Открылся набор');
    expect(toGuest.text).toContain('JS Core — Поток 1');
    await waitForSentTo(1002, 'Открылся набор');

    // Потока нет — приглашений нет
    transport.reset();
    publish(StreamEvents.created, {
      streamId: UNKNOWN_ID,
      moduleId: MODULE_JS_SYNTAX,
    });
    await Bun.sleep(200);
    expect(transport.api.sentMessages).toEqual([]);

    // Модуль вне опубликованных программ — совпадений нет
    publish(StreamEvents.created, {
      streamId: STREAM_ENROLLMENT,
      moduleId: UNKNOWN_ID,
    });
    await Bun.sleep(200);
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P7-62: wish.invited с недоступным потоком — приглашение не отправляется', async () => {
    transport.reset();
    publish(WishEvents.invited, {
      userId: USER_GUEST,
      telegramId: 1001,
      streamId: UNKNOWN_ID,
      targetKind: 'course',
      courseId: COURSE_JS_BASICS,
    });

    await Bun.sleep(200);
    expect(transport.api.sentMessages).toEqual([]);
  });
});
