import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { AbandonUc } from './abandon.uc';
import {
  MISSING,
  makeEnv,
  OWNER_INFO,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  respondent,
  state,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (abandon): причина by_user; повтор идемпотентен (Т3).

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new AbandonUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(state('in_progress'));
});

describe('AbandonUc', () => {
  it('in_progress → abandoned, by_user в state и в событии', async () => {
    expect(expectOk(await run())).toEqual({});
    expect(env.stored()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'by_user',
    });
    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.abandoned',
        {
          questionnaireId: QUESTIONNAIRE,
          respondentId: RESPONDENT,
          kind: 'standard',
          ownerInfo: OWNER_INFO,
          reason: 'by_user',
        },
      ],
    ]);
  });

  it('повтор на abandoned — Ok без события и без записи', async () => {
    env.seed(state('abandoned', { abandonReason: 'timeout' }));
    expect(expectOk(await run())).toEqual({});
    expect(env.ctx.published).toEqual([]);
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.stored().abandonReason).toBe('timeout');
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(respondent, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });
});
