import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { DeclineInviteUc } from './decline-invite.uc';
import {
  admin,
  anonymous,
  MISSING,
  makeEnv,
  OWNER_INFO,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  respondent,
  state,
  stranger,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (decline-invite): в state by_user, в событии declined (Т4).

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new DeclineInviteUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(state('invited', { currentQuestionCode: null }));
});

describe('DeclineInviteUc', () => {
  it('invited → abandoned, abandonReason by_user', async () => {
    expect(expectOk(await run())).toEqual({});
    expect(env.stored()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'by_user',
    });
  });

  it('публикует abandoned с reason: declined', async () => {
    await run();
    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.abandoned',
        {
          questionnaireId: QUESTIONNAIRE,
          respondentId: RESPONDENT,
          kind: 'standard',
          ownerInfo: OWNER_INFO,
          reason: 'declined',
        },
      ],
    ]);
  });

  it('админ отказывается за респондента', async () => {
    expectOk(await run(admin));
    expect(env.stored().status).toBe('abandoned');
  });

  it.each(['in_progress', 'completed', 'abandoned'] as const)(
    'из %s — QUESTIONNAIRE_NOT_INVITED, события нет',
    async (status) => {
      env.seed(state(status));
      expectErr(await run(), 'QUESTIONNAIRE_NOT_INVITED');
      expect(env.ctx.published).toEqual([]);
      expect(env.questionnaires.saved).toEqual([]);
    },
  );

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(respondent, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });

  it('чужая анкета — ACCESS_DENIED, статус прежний', async () => {
    expectErr(await run(stranger), 'ACCESS_DENIED');
    expect(env.stored().status).toBe('invited');
  });

  it('гость — UNAUTHORIZED', async () => {
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});
