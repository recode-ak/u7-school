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
  makeEnv,
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
});

describe('SweepAbandonedQuestionnairesJob — ступени 3/6/9', () => {
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

  it('цепочка 3 → 6 → 9 ч по тикам: invite, warning, abandoned', async () => {
    for (const h of [3, 6, 9]) await sweepAt(h);
    expect(names()).toEqual(['continueInvite', 'abandonWarning', 'abandoned']);
  });
});
