import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { now } from '@u7-scl/core/shared';
import {
  INVITE_AFTER_IDLE_MS,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  QuestionnairePoolSchema,
  StartQuestionnaireUcDef,
  SweepAbandonedQuestionnairesJobDef,
} from '@u7-scl/domain/questionnaire/contract';
import { type OperationRef, SystemCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import { CORE_EDUCATION_ANCHOR } from '../worlds';
import { createTestApp, type TestApp } from './test-app';
import { TestClock } from './test-clock';

const T0 = CORE_EDUCATION_ANCHOR.getTime();
const HOUR = 3_600_000;
const FROM: OperationRef = { kind: 'useCase', module: 'probe', name: 'probe' };

const pool = () =>
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

describe('createTestApp: управляемые часы (F-01)', () => {
  let app: TestApp & { clock: TestClock };

  beforeAll(async () => {
    // startAt не задан — старт с якоря мира
    app = await createTestApp('test-clock', undefined, { clock: {} });
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('стартует с заданного момента, advance и set двигают время', () => {
    expect(app.clock.now()).toBe(T0);
    expect(now().getTime()).toBe(T0);
    app.clock.advance(HOUR);
    expect(now().getTime()).toBe(T0 + HOUR);
    app.clock.set(T0 + 5 * HOUR);
    expect(now().getTime()).toBe(T0 + 5 * HOUR);
    app.clock.set(T0);
  });

  test('Job sweepAbandonedQuestionnaires после advance(3 ч) даёт continueInvite', async () => {
    const respondent = await app.userByTelegramId(1007);
    const events: string[] = [];
    const unsubscribe = app.eventBus.subscribe(
      QuestionnaireEvents.continueInvite,
      async (envelope) => {
        events.push(envelope.name);
      },
    );

    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: pool(),
          ownerInfo: { courseId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        }),
        new SystemCaller(FROM, respondent),
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    );

    expectOk(
      await app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );
    await Bun.sleep(50);
    expect(events).toEqual([]);

    app.clock.advance(INVITE_AFTER_IDLE_MS);
    expectOk(
      await app.runJob(
        QuestionnaireModuleDef,
        SweepAbandonedQuestionnairesJobDef,
      ),
    );
    await Bun.sleep(50);
    unsubscribe();
    expect(events).toEqual([QuestionnaireEvents.continueInvite.name]);
  });
});

describe('createTestApp: часы не заданы / cleanup', () => {
  test('без опции часы реальные, cleanup возвращает системные', async () => {
    const plain = await createTestApp('test-clock-none');
    expect(plain.clock).toBeUndefined();
    await plain.cleanup();

    const fake = await createTestApp('test-clock-restore', undefined, {
      clock: { startAt: T0 },
    });
    expect(now().getTime()).toBe(T0);
    await fake.cleanup();
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(5_000);
  });
});

describe('TestClock: единственные активные часы', () => {
  test('второй TestClock до restore() бросает ошибку', () => {
    const first = new TestClock(T0);
    expect(() => new TestClock(T0)).toThrow('уже есть активные часы');
    first.restore();
    const second = new TestClock(T0);
    second.restore();
  });
});
