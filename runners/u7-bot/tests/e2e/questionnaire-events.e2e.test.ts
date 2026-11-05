import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import {
  LikertQuestionPoolSchema,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  QuestionnairePoolSchema,
  SendLikertInviteUcDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import type {
  SentMessage,
  TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { createTestBotTransport } from '@u7-scl/test-helpers/test-bot-transport';
import { type OperationRef, SystemCaller, UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';

/**
 * E2E пяти Def-событий анкеты в боте (срез UI): подписки `FillStory`
 * (`started`, `abandonWarning`, `continueInvite`, `abandoned`) и
 * `InviteStory` (`invited`) на шине под FQN Def.
 *   1) `started` — реальный `startQuestionnaire`: с `courseId` приглашение
 *      с кнопкой-мостом, без — подсказка входа через /start;
 *   2) `invited` — реальный `sendLikertInvite`: «📋 Анкета», кнопки
 *      `questionnaire:invite:start|why|decline:<id>`;
 *   3) `abandonWarning`, `continueInvite`, `abandoned(timeout)` — публикация
 *      события на шине (часами `createTestApp` не управляет, Job покрыт
 *      модульными тестами);
 *   4) отрицательные: `abandoned` с `by_user`/`declined` — тишина; `invited` и
 *      события без профиля респондента — тишина без падения (следующее
 *      событие доходит).
 * Адрес событие не несёт: telegramId бот берёт по профилю респондента.
 */

const COURSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FROM: OperationRef = {
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
};
const UNKNOWN_USER_ID = '00000000-0000-4000-8000-0000000000aa';

const trace = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

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
  let respondent: User;

  beforeAll(async () => {
    app = await createTestApp('questionnaire-events-e2e');
    transport = createTestBotTransport(app, [new QuestionnaireController()]);
    respondent = (await app.userFacade.getUserByTelegramId(1007))!;
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

  /** Сообщения пользователю после паузы доставки — для проверок «тишины». */
  async function sentToAfterPause(tgId: number): Promise<SentMessage[]> {
    await Bun.sleep(200);
    return transport.api.sentMessages.filter((m) => m.telegramId === tgId);
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
  function publish<E extends { name: string; payload: v.GenericSchema }>(
    event: E,
    payload: v.InferInput<E['payload']>,
  ): void {
    app.eventBus.publish({
      eventId: crypto.randomUUID(),
      eventName: event.name,
      occurredAt: new Date().toISOString(),
      aggregateName: 'Questionnaire',
      aggregateId: crypto.randomUUID(),
      payload: v.parse(event.payload, payload),
    } as never);
  }

  const base = (overrides: Record<string, unknown> = {}) => ({
    questionnaireId: crypto.randomUUID(),
    respondentId: respondent.uuid,
    kind: 'standard' as const,
    ownerInfo: { courseId: COURSE_ID },
    ...overrides,
  });

  const abandonedBase = (
    reason: 'timeout' | 'by_user' | 'declined',
    overrides: { respondentId?: string } = {},
  ) => ({ ...base(), ...overrides, reason });

  // ── started ──

  test('started с courseId: приглашение «заполнить анкету» с кнопкой-мостом resume', async () => {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: standardPool(),
          ownerInfo: { courseId: COURSE_ID },
        }),
        new SystemCaller(FROM, new UserCaller(respondent)),
        trace(),
      ),
    );

    const msg = await waitForSent(
      respondent.telegramId,
      'Для вас подготовлена анкета',
    );
    expect(msg.text).toContain('📋');
    expect(actionsOf(msg)).toEqual([
      ['▶️ Заполнить анкету', 'questionnaire:fill:resume:'],
    ]);
  });

  test('started без courseId: подсказка входа через /start, без кнопок', async () => {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: standardPool(),
          ownerInfo: {},
        }),
        new SystemCaller(FROM, new UserCaller(respondent)),
        trace(),
      ),
    );

    const msg = await waitForSent(respondent.telegramId, '/start');
    expect(msg.text).toContain('Для вас подготовлена анкета');
    expect(msg.keyboard?.rows.flat() ?? []).toEqual([]);
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
        new SystemCaller(FROM, new UserCaller(respondent)),
        trace(),
      ),
    );

    const msg = await waitForSent(respondent.telegramId, 'Оцените коллегу');
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

  test('invited без профиля респондента: сообщения нет, бот не падает, следующее событие доходит', async () => {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        SendLikertInviteUcDef.command({
          pool: likertPool(),
          ownerInfo: { context: 'module_completed' },
        }),
        new SystemCaller(
          FROM,
          new UserCaller({ ...respondent, uuid: UNKNOWN_USER_ID }),
        ),
        trace(),
      ),
    );

    expect(await sentToAfterPause(respondent.telegramId)).toEqual([]);

    publish(QuestionnaireEvents.continueInvite, base());
    await waitForSent(respondent.telegramId, 'продолжим?');
  });

  // ── abandonWarning / continueInvite / abandoned ──

  test('abandonWarning: «Анкета приостановлена» с кнопками «Продолжить» и «Прервать»', async () => {
    const qId = crypto.randomUUID();
    publish(QuestionnaireEvents.abandonWarning, base({ questionnaireId: qId }));

    const msg = await waitForSent(
      respondent.telegramId,
      'Анкета приостановлена',
    );
    expect(actionsOf(msg)).toEqual([
      ['▶️ Продолжить', 'questionnaire:fill:resume:'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:'],
    ]);
  });

  test('continueInvite: «продолжим?» с кнопками «Продолжить анкету» и «Прервать»', async () => {
    const qId = crypto.randomUUID();
    publish(QuestionnaireEvents.continueInvite, base({ questionnaireId: qId }));

    const msg = await waitForSent(respondent.telegramId, 'продолжим?');
    expect(actionsOf(msg)).toEqual([
      ['▶️ Продолжить анкету', 'questionnaire:fill:resume:'],
      ['⏭️ Прервать', 'questionnaire:fill:cancel:'],
    ]);
  });

  test('abandoned(timeout): уведомление о закрытии из-за неактивности', async () => {
    publish(QuestionnaireEvents.abandoned, abandonedBase('timeout'));

    const msg = await waitForSent(
      respondent.telegramId,
      'длительной неактивности',
    );
    expect(msg.keyboard?.rows.flat() ?? []).toEqual([]);
  });

  // ── Отрицательные ──

  test('abandoned(by_user): сообщения нет', async () => {
    publish(QuestionnaireEvents.abandoned, abandonedBase('by_user'));

    expect(await sentToAfterPause(respondent.telegramId)).toEqual([]);
  });

  test('abandoned(declined): сообщения нет', async () => {
    publish(QuestionnaireEvents.abandoned, abandonedBase('declined'));

    expect(await sentToAfterPause(respondent.telegramId)).toEqual([]);
  });

  test('нет профиля респондента: события без сообщений и без падения, следующее событие доходит', async () => {
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
    await waitForSent(respondent.telegramId, 'продолжим?');
  });
});
