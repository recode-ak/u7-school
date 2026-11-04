import { beforeEach, describe, expect, it } from 'bun:test';
import {
  INVITE_AFTER_IDLE_MS,
  SweepAbandonedQuestionnairesJobDef,
} from '@u7-scl/domain/questionnaire';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import {
  HOUR,
  likertState,
  makeEnv,
  OTHER_QUESTIONNAIRE,
  OWNER_INFO,
  QUESTIONNAIRE,
  RESPONDENT,
  state,
  T0,
} from '../uc/questionnaire-uc.fixture';
import { SweepAbandonedQuestionnairesJob } from './sweep-abandoned-questionnaires.job';

// Перенос `api/questionnaire/sweep-abandoned-job.test.ts` и `.stages.test.ts`.
// Job доменный (D-63): адрес не читает, события — без `telegramId`, по одному на
// запись в UoW; решение ступени принимает `QuestionnaireAr.sweepIdle`.

const THIRD = '00000000-0000-4000-8000-000000000044';
let env: ReturnType<typeof makeEnv>;

/** Прогон Job в момент `T0 + hours`; события шины — в `env.ctx.published`. */
async function sweepAt(hours: number) {
  env.ctx.setNow(T0 + hours * HOUR);
  const job = new SweepAbandonedQuestionnairesJob(
    env.deps,
    QuestionnaireModuleDef,
  );
  return expectOk(
    await job.handle(Trace.forJob(SweepAbandonedQuestionnairesJobDef)),
  );
}
const names = () => env.ctx.published.map((e) => e.name.split('.').at(-1));
const ref = (extra: object = {}) => ({
  questionnaireId: QUESTIONNAIRE,
  respondentId: RESPONDENT,
  kind: 'standard',
  ownerInfo: OWNER_INFO,
  ...extra,
});

beforeEach(() => {
  env = makeEnv();
  env.seed(state('in_progress'));
});

describe('SweepAbandonedQuestionnairesJob — отбор', () => {
  it('ищет простой от 3 ч только среди standard', async () => {
    const calls: unknown[] = [];
    const find = env.questionnaires.findIdle;
    env.questionnaires.findIdle = async (params) => {
      calls.push(params);
      return find(params);
    };
    await sweepAt(1);
    expect(calls).toEqual([
      { idleMs: INVITE_AFTER_IDLE_MS, at: T0 + HOUR, kinds: ['standard'] },
    ]);
  });

  it('свежая анкета (1 ч) — тихо: ни записи, ни события', async () => {
    await sweepAt(1);
    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('likert-анкета не затрагивается, даже при простое 10 ч', async () => {
    env.seed(likertState('in_progress'));
    await sweepAt(10);
    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('completed и abandoned не затрагиваются', async () => {
    env.seed(
      state('completed', { completedAt: T0 }),
      state('abandoned', {
        uuid: OTHER_QUESTIONNAIRE,
        abandonReason: 'by_user',
      }),
    );
    await sweepAt(10);
    expect(env.ctx.published).toEqual([]);
  });
});

describe('SweepAbandonedQuestionnairesJob — ступени 3/6/9', () => {
  it('3.5 ч → continueInvite; continueInvitedAt записан, updatedAt не сдвинут (Т1)', async () => {
    await sweepAt(3.5);
    expect(env.stored()).toMatchObject({
      continueInvitedAt: T0 + 3.5 * HOUR,
      updatedAt: T0,
      status: 'in_progress',
    });
    expect(env.events()).toEqual([
      ['questionnaire.questionnaire.continueInvite', ref()],
    ]);
  });

  it('5 ч → приглашение продолжить, ещё не предупреждение', async () => {
    await sweepAt(5);
    expect(names()).toEqual(['continueInvite']);
  });

  it('6 ч → abandonWarning; warnedAt записан, updatedAt прежний; ступень 3 ч пропущена', async () => {
    await sweepAt(6);
    expect(env.stored()).toMatchObject({
      warnedAt: T0 + 6 * HOUR,
      updatedAt: T0,
    });
    expect(env.stored().continueInvitedAt).toBeUndefined();
    expect(env.events()).toEqual([
      ['questionnaire.questionnaire.abandonWarning', ref()],
    ]);
  });

  it('8.5 ч без warnedAt → предупреждение, не закрытие', async () => {
    await sweepAt(8.5);
    expect(env.stored().status).toBe('in_progress');
    expect(names()).toEqual(['abandonWarning']);
  });

  it('7 ч с continueInvitedAt, без warnedAt → только предупреждение', async () => {
    env.seed(state('in_progress', { continueInvitedAt: T0 + 3 * HOUR }));
    await sweepAt(7);
    expect(names()).toEqual(['abandonWarning']);
  });

  it('9 ч → abandoned, abandonReason timeout, событие reason: timeout', async () => {
    await sweepAt(9);
    expect(env.stored()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'timeout',
    });
    expect(env.events()).toEqual([
      ['questionnaire.questionnaire.abandoned', ref({ reason: 'timeout' })],
    ]);
  });

  it('9 ч с уже выставленным warnedAt — закрывается', async () => {
    env.seed(state('in_progress', { warnedAt: T0 + 7 * HOUR }));
    await sweepAt(9);
    expect(env.stored().status).toBe('abandoned');
  });

  it('события без telegramId и response (D-63, Q3)', async () => {
    await sweepAt(9);
    expect(env.ctx.published[0]?.payload).not.toHaveProperty('telegramId');
    expect(env.ctx.published[0]?.payload).not.toHaveProperty('response');
  });

  it('цепочка 3 → 6 → 9 ч по тикам: invite, warning, abandoned', async () => {
    for (const h of [3, 6, 9]) await sweepAt(h);
    expect(names()).toEqual(['continueInvite', 'abandonWarning', 'abandoned']);
  });
});

describe('SweepAbandonedQuestionnairesJob — идемпотентность и сброс', () => {
  it('повторный тик в тот же момент ничего не публикует и не пишет', async () => {
    await sweepAt(4);
    env.ctx.published.length = 0;
    const writes = env.questionnaires.saved.length;

    await sweepAt(4);

    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toHaveLength(writes);
  });

  it('после приглашения (continueInvitedAt, 4 ч) — дубля нет', async () => {
    env.seed(state('in_progress', { continueInvitedAt: T0 + 3.5 * HOUR }));
    await sweepAt(4);
    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('после предупреждения (warnedAt, 7 ч) — дубля нет', async () => {
    env.seed(state('in_progress', { warnedAt: T0 + 6.5 * HOUR }));
    await sweepAt(7);
    expect(env.ctx.published).toEqual([]);
  });

  it('возобновление сбрасывает цепочку: без флагов приглашение приходит снова', async () => {
    env.seed(state('in_progress', { updatedAt: T0 + 5 * HOUR }));
    await sweepAt(8.5);
    expect(names()).toEqual(['continueInvite']);
  });
});

describe('SweepAbandonedQuestionnairesJob — invited (Т7)', () => {
  beforeEach(() => {
    env.seed(state('invited', { currentQuestionCode: null }));
  });

  it.each([4, 7])('%s ч: без флагов, записи и событий', async (hours) => {
    await sweepAt(hours);
    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('9 ч: закрывается с событием abandoned { timeout }', async () => {
    await sweepAt(9);
    expect(env.stored()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'timeout',
    });
    expect(names()).toEqual(['abandoned']);
  });
});

describe('SweepAbandonedQuestionnairesJob — сбой записи', () => {
  it('сбой одной анкеты не прерывает обход остальных', async () => {
    env.seed(
      state('in_progress'),
      state('in_progress', { uuid: OTHER_QUESTIONNAIRE }),
      state('in_progress', { uuid: THIRD }),
    );
    env.questionnaires.failOn(OTHER_QUESTIONNAIRE);

    await sweepAt(9);

    expect(env.stored(QUESTIONNAIRE).status).toBe('abandoned');
    expect(env.stored(THIRD).status).toBe('abandoned');
    expect(env.stored(OTHER_QUESTIONNAIRE).status).toBe('in_progress');
    expect(env.ctx.published.map((e) => e.aggregateId).sort()).toEqual(
      [QUESTIONNAIRE, THIRD].sort(),
    );
  });
});
