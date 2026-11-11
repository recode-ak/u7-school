import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
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
import { type OperationRef, SystemCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';
import { userActor } from '../../src/core/user-actor.test-kit';

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
        trace(),
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
        trace(),
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
        trace(),
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
