import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  GetQuestionnairesByUserUcDef,
  GetQuestionnaireUcDef,
  LikertQuestionPoolSchema,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  QuestionnairePoolSchema,
  SendLikertInviteUcDef,
  StartQuestionnaireUcDef,
  SweepAbandonedQuestionnairesJobDef,
} from '@u7-scl/domain/questionnaire/contract';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import type {
  SentMessage,
  TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { createTestBotTransport } from '@u7-scl/test-helpers/test-bot-transport';
import type { TestClock } from '@u7-scl/test-helpers/test-clock';
import { type AnyEventDef, type OperationRef, SystemCaller } from 'dmg-core';
import { expectOk, testTrace } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';
import { userActor } from '../../src/core/user-actor.test-kit';
import { CORE_EDUCATION_WORLD } from '../worlds';

/**
 * E2E пяти Def-событий анкеты в боте (срез UI): подписки `FillStory`
 * (`started`, `abandonWarning`, `continueInvite`, `abandoned`) и
 * `InviteStory` (`invited`) на шине под FQN Def.
 *   1) `started` — реальный `startQuestionnaire`: сообщение доставлено,
 *      кнопка несёт действие `questionnaire:fill:resume:<courseId>`;
 *   2) `invited` — реальный `sendLikertInvite`: «📋 Анкета», кнопки
 *      `questionnaire:invite:start|why|decline:<id>`;
 *   3) отрицательные: `invited` и остальные события без профиля респондента —
 *      тишина без падения (следующее событие доходит).
 * Тексты приглашений держат unit-тесты стори; здесь — факт доставки и коды.
 * Адрес событие не несёт: telegramId бот берёт по профилю респондента.
 */

const COURSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
/** Пул одного вопроса — для анкет, которые обходит Job. */
const sweepPool = () =>
  v.parse(QuestionnairePoolSchema, {
    inviteText: 'Приглашаем пройти опрос',
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
      // Второй вопрос: ответ на первый оставляет анкету in_progress
      {
        question: 'Готов продолжить?',
        questionCode: 'q2',
        type: 'choice',
        multiple: false,
        answers: [{ answer: 'Да', answerCode: 'yes' }],
      },
    ],
  });
const FROM: OperationRef = {
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
};
const UNKNOWN_USER_ID = '00000000-0000-4000-8000-0000000000aa';

const standardPool = () =>
  v.parse(QuestionnairePoolSchema, {
    inviteText: 'Приглашаем пройти опрос',
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
      // Второй вопрос: ответ на первый оставляет анкету in_progress
      {
        question: 'Готов продолжить?',
        questionCode: 'q2',
        type: 'choice',
        multiple: false,
        answers: [{ answer: 'Да', answerCode: 'yes' }],
      },
    ],
  });

const likertPool = () =>
  v.parse(LikertQuestionPoolSchema, {
    inviteText: 'Оцените коллегу, пожалуйста',
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

describe('Questionnaire: Def-события в боте (e2e)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let respondent: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('questionnaire-events-e2e');
    transport = createTestBotTransport(app, [new QuestionnaireController()]);
    respondent = await app.userByTelegramId(1007);
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
      if (Date.now() > deadline) throw new Error(`Таймаут ожидания: ${what}`);
      await Bun.sleep(25);
    }
  }

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

  /**
   * Действие кнопки: транспорт сжимает uuid (`~<short>`) и дописывает штамп
   * `:~<seq>`, поэтому сравниваем действие (до сжатых сегментов) и подпись.
   */
  const actionOf = (code: string): string => {
    const parts = code.split(':');
    const short = parts.findIndex((p) => p.startsWith('~'));
    return `${(short === -1 ? parts : parts.slice(0, short)).join(':')}:`;
  };

  /** Пары «подпись — действие» кнопок сообщения, по порядку. */
  const actionsOf = (m: SentMessage) =>
    (m.keyboard?.rows.flat() ?? []).map((b) => [b.text, actionOf(b.code)]);

  /** Сжатые id (uuid) из кодов кнопок сообщения. */
  const shortIdsOf = (m: SentMessage) =>
    (m.keyboard?.rows.flat() ?? []).map((b) =>
      b.code.split(':').find((p) => p.startsWith('~')),
    );
  /** Публикует Def-событие анкеты под FQN (payload валидируется схемой Def). */
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

  const base = (overrides: Record<string, unknown> = {}) => ({
    questionnaireId: crypto.randomUUID(),
    respondentId: respondent.user.uuid,
    kind: 'standard' as const,
    ownerInfo: { courseId: COURSE_ID },
    ...overrides,
  });

  const abandonedBase = (
    reason: 'timeout' | 'by_user' | 'declined',
    overrides: { respondentId?: string } = {},
  ) => ({ ...base(), ...overrides, reason });

  // ── started ──

  test('started с courseId: сообщение доставлено, кнопка несёт действие resume', async () => {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: standardPool(),
          ownerInfo: { courseId: COURSE_ID },
        }),
        new SystemCaller(FROM, respondent),
        testTrace(),
      ),
    );

    const msg = await waitFor('сообщение респонденту', () =>
      transport.api.sentMessages.find(
        (m) => m.telegramId === respondent.user.view().telegramId,
      ),
    );
    expect(actionsOf(msg)).toEqual([
      ['▶️ Заполнить анкету', 'questionnaire:fill:resume:'],
    ]);
  });

  // ── invited ──

  test('invited: «📋 Анкета» с текстом пула и кнопками start/why/decline', async () => {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        SendLikertInviteUcDef.command({
          pool: likertPool(),
          ownerInfo: { context: 'module_completed' },
        }),
        new SystemCaller(FROM, respondent),
        testTrace(),
      ),
    );

    const msg = await waitForSent(
      respondent.user.view().telegramId,
      'Оцените коллегу',
    );
    expect(msg.text).toContain('📋');
    expect(msg.text).toContain('Анкета');
    expect(actionsOf(msg)).toEqual([
      ['▶️ Начать заполнение', 'questionnaire:invite:start:'],
      ['❔ Зачем это нужно?', 'questionnaire:invite:why:'],
      ['⏭️ Пропустить', 'questionnaire:invite:decline:'],
    ]);
    const shortIds = shortIdsOf(msg);
    expect(shortIds.every((id) => id !== undefined && id.length > 1)).toBe(
      true,
    );
    // все три кнопки — про одну анкету
    expect(new Set(shortIds).size).toBe(1);
  });

  // ── Отрицательные ──

  test('нет профиля респондента: invited и события — тишина без падения, следующее событие доходит', async () => {
    // invited из реального UC: адресат — неизвестный профилю uuid
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        SendLikertInviteUcDef.command({
          pool: likertPool(),
          ownerInfo: { context: 'module_completed' },
        }),
        new SystemCaller(
          FROM,
          userActor({ uuid: UNKNOWN_USER_ID, roles: ['GUEST'] }),
        ),
        testTrace(),
      ),
    );

    publish(
      QuestionnaireEvents.abandonWarning,
      base({ respondentId: UNKNOWN_USER_ID }),
    );
    publish(
      QuestionnaireEvents.continueInvite,
      base({ respondentId: UNKNOWN_USER_ID }),
    );
    publish(
      QuestionnaireEvents.abandoned,
      abandonedBase('timeout', { respondentId: UNKNOWN_USER_ID }),
    );
    await Bun.sleep(200);
    expect(transport.api.sentMessages).toEqual([]);

    publish(QuestionnaireEvents.continueInvite, base());
    await waitForSent(respondent.user.view().telegramId, 'продолжим?');
  });
});

// ═══ F-32: Job обхода брошенных анкет (P7-49…P7-54) ═══

const HOUR_MS = 60 * 60 * 1000;
const SWEEP_MARINA_TG = 1007;

interface SweepStand {
  app: TestApp & { clock: TestClock };
  transport: TestBotTransport;
  marina: U7BotActor;
}

/**
 * Стенд с управляемыми часами: старт — якорь мира. Анкеты создаются
 * реальным UC, затем простой доводится правкой `updatedAt` во ВРЕМЕННЫХ
 * фикстурах (`app.fixtures.dbDir`), как в образце сбоя репозитория.
 */
async function createSweepStand(tag: string): Promise<SweepStand> {
  const app = await createTestApp(tag, CORE_EDUCATION_WORLD, { clock: {} });
  // AppController — чтобы после /start был экран с кнопкой (штамп для
  // прямого вызова стори), анкета — чтобы пришёл приглашённый диалог
  const transport = createTestBotTransport(app, [
    new AppController('https://t.me/u7_school_group'),
    new QuestionnaireController(),
  ]);
  const marina = await app.userByTelegramId(SWEEP_MARINA_TG);
  return { app, transport, marina };
}

describe('Questionnaire: Job обхода брошенных (e2e)', () => {
  let stand: SweepStand;

  afterEach(async () => {
    await stand?.app.cleanup();
  });

  // ── Хелперы ──

  const questionnairesFile = () =>
    `${stand.app.fixtures.dbDir}/questionnaires/questionnaires.json`;

  /** Настоящая анкета in_progress (старт из каталога) — её обходит Job. */
  async function createStandard(courseId: string): Promise<string> {
    expectOk(
      await stand.app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: sweepPool(),
          ownerInfo: { courseId },
        }),
        new SystemCaller(FROM, stand.marina),
        testTrace(),
      ),
    );
    const list = expectOk(
      await stand.app.apiApp.dispatch(
        QuestionnaireModuleDef,
        GetQuestionnairesByUserUcDef.command({
          userId: stand.marina.user.uuid,
        }),
        stand.marina,
        testTrace(),
      ),
    );
    const created = list.find((q) => String(q.ownerInfo.courseId) === courseId);
    if (!created) throw new Error('Созданная анкета не найдена');
    return created.uuid;
  }

  /** Возраст последней активности: `updatedAt` = «сейчас» минус простой. */
  async function setIdle(qId: string, idleMs: number): Promise<void> {
    const rows = (await Bun.file(questionnairesFile()).json()) as Array<
      Record<string, unknown>
    >;
    const row = rows.find((r) => r.uuid === qId);
    if (!row) throw new Error('Анкета не найдена в фикстурах');
    row.updatedAt = stand.app.clock.now() - idleMs;
    await Bun.write(questionnairesFile(), JSON.stringify(rows));
  }

  /** Состояние анкеты после прогона Job. */
  async function viewOf(qId: string) {
    return expectOk(
      await stand.app.apiApp.dispatch(
        QuestionnaireModuleDef,
        GetQuestionnaireUcDef.command({ questionnaireId: qId }),
        stand.marina,
        testTrace(),
      ),
    );
  }

  const tgIdOf = () => stand.marina.user.view().telegramId;

  const waitForSent = async (
    textContains: string,
  ): Promise<SentMessage | undefined> => {
    const deadline = Date.now() + 3000;
    for (;;) {
      const found = stand.transport.api.sentMessages.find(
        (m) => m.telegramId === tgIdOf() && m.text.includes(textContains),
      );
      if (found) return found;
      if (Date.now() > deadline) return undefined;
      await Bun.sleep(25);
    }
  };

  const actionOf = (code: string): string => {
    const parts = code.split(':');
    const short = parts.findIndex((p) => p.startsWith('~'));
    return `${(short === -1 ? parts : parts.slice(0, short)).join(':')}:`;
  };

  const actionsOf = (m: SentMessage) =>
    (m.keyboard?.rows.flat() ?? []).map((b) => [b.text, actionOf(b.code)]);

  const publish = (
    event: typeof QuestionnaireEvents.abandoned,
    payload: { questionnaireId: string; respondentId: string; reason: string },
  ): void => {
    stand.app.eventBus.publish(
      envelopeOf(
        event,
        v.parse(event.payload, {
          ...payload,
          kind: 'standard',
          ownerInfo: { courseId: COURSE_ID },
        }) as never,
        { occurredAt: Date.now(), aggregateId: crypto.randomUUID() },
      ),
    );
  };

  // ── Ступени простоя ──

  test('P7-49: простой 3 ч — приглашение продолжить, метка continueInvitedAt', async () => {
    stand = await createSweepStand('sweep-invite');
    const qId = await createStandard(crypto.randomUUID());
    stand.transport.reset();
    await setIdle(qId, 4 * HOUR_MS);

    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );

    const message = await waitForSent('продолжим?');
    expect(message).toBeDefined();
    expect(actionsOf(message as SentMessage)).toEqual([
      ['▶️ Продолжить анкету', 'questionnaire:fill:resume:'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:'],
    ]);

    const view = await viewOf(qId);
    expect(view.status).toBe('in_progress');
    expect(view.continueInvitedAt).toBe(stand.app.clock.now());
    expect(view.warnedAt).toBeUndefined();
  });

  test('P7-50: простой 6 ч — предупреждение о закрытии, метка warnedAt', async () => {
    stand = await createSweepStand('sweep-warn');
    const qId = await createStandard(crypto.randomUUID());
    stand.transport.reset();
    await setIdle(qId, 7 * HOUR_MS);

    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );

    const message = await waitForSent('Анкета приостановлена');
    expect(message).toBeDefined();
    expect(message?.text).toContain('Продолжить?');
    expect(actionsOf(message as SentMessage)).toEqual([
      ['▶️ Продолжить', 'questionnaire:fill:resume:'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:'],
    ]);

    const view = await viewOf(qId);
    expect(view.warnedAt).toBe(stand.app.clock.now());
    expect(view.status).toBe('in_progress');
  });

  test('P7-51: простой 9 ч — закрытие по таймауту и уведомление без кнопок', async () => {
    stand = await createSweepStand('sweep-abandon');
    const qId = await createStandard(crypto.randomUUID());
    stand.transport.reset();
    await setIdle(qId, 10 * HOUR_MS);

    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );

    const message = await waitForSent('Анкета была закрыта');
    expect(message).toBeDefined();
    expect(message?.keyboard).toBeUndefined();

    const view = await viewOf(qId);
    expect(view.status).toBe('abandoned');
    expect(view.abandonReason).toBe('timeout');
  });

  test('P7-52: ручное прерывание и таймаут без профиля — тишина', async () => {
    stand = await createSweepStand('sweep-silence');
    stand.transport.reset();
    // Ручное прерывание: экран «Анкета прервана» уже показан, дубля нет
    publish(QuestionnaireEvents.abandoned, {
      questionnaireId: crypto.randomUUID(),
      respondentId: stand.marina.user.uuid,
      reason: 'by_user',
    });
    // Таймаут с неизвестным профилю respondentId — адресата нет
    publish(QuestionnaireEvents.abandoned, {
      questionnaireId: crypto.randomUUID(),
      respondentId: UNKNOWN_USER_ID,
      reason: 'timeout',
    });
    await Bun.sleep(200);
    expect(stand.transport.api.sentMessages).toEqual([]);

    // Следующее событие доходит: подписка не сломалась
    publish(QuestionnaireEvents.abandoned, {
      questionnaireId: crypto.randomUUID(),
      respondentId: stand.marina.user.uuid,
      reason: 'timeout',
    });
    expect(await waitForSent('Анкета была закрыта')).toBeDefined();
  });

  test('P7-54: активность сбрасывает метки — ступень простоя начинается заново', async () => {
    stand = await createSweepStand('sweep-reset');
    const courseId = crypto.randomUUID();
    const qId = await createStandard(courseId);
    stand.transport.reset();
    await setIdle(qId, 4 * HOUR_MS);

    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );
    expect(await waitForSent('продолжим?')).toBeDefined();

    // Ожидаемый простой 5 ч: метка приглашения стоит — повтора нет
    stand.app.clock.advance(HOUR_MS);
    const before = stand.transport.api.sentMessages.length;
    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );
    await Bun.sleep(200);
    expect(stand.transport.api.sentMessages.length).toBe(before);

    // Пользователь вернулся: /start открывает диалог, resume — по курсу
    await stand.transport.handleStart(stand.transport.makeBotContext(tgIdOf()));
    await stand.transport.pressRaw(
      tgIdOf(),
      `questionnaire:fill:resume:${courseId}`,
    );
    const answer = stand.transport.api.sentMessages
      .at(-1)
      ?.keyboard?.rows.flat()
      .find((b) => b.text === '1');
    if (!answer) throw new Error('Нет кнопки ответа');
    await stand.transport.handleCallback(
      stand.transport.makeBotContext(tgIdOf(), {
        callbackData: answer.code,
      }),
    );

    const afterAnswer = await viewOf(qId);
    expect(afterAnswer.status).toBe('in_progress');
    expect(afterAnswer.continueInvitedAt).toBeUndefined();
    expect(afterAnswer.warnedAt).toBeUndefined();

    // Цепочка заново: через 3 ч простоя — новое приглашение
    stand.app.clock.advance(3 * HOUR_MS + 5 * 60 * 1000);
    stand.transport.reset();
    expectOk(
      await stand.app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );
    expect(await waitForSent('продолжим?')).toBeDefined();
  });
});
