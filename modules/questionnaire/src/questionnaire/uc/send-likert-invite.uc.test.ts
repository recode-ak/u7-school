import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import {
  likertPool,
  makeEnv,
  OTHER_USER,
  REQ,
  RESPONDENT,
  systemFor,
} from './questionnaire-uc.fixture';
import { SendLikertInviteUc } from './send-likert-invite.uc';

// Перенос `api/module.test.ts` (send-likert-invite): likert-анкета создаётся invited.

let env: ReturnType<typeof makeEnv>;
const info = {
  context: 'module_completed',
  role: 'student_student',
  subjectId: OTHER_USER,
};
const run = (caller: Caller<QuestionnaireUser> = systemFor()) =>
  new SendLikertInviteUc(env.deps, QuestionnaireModuleDef).handle(
    { pool: likertPool(), ownerInfo: info },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
});

describe('SendLikertInviteUc', () => {
  it('создаёт likert-анкету invited за субъекта вызова и публикует invited', async () => {
    expect(expectOk(await run())).toEqual({});
    const saved = env.questionnaires.saved[0];
    expect(saved).toMatchObject({
      kind: 'likert',
      status: 'invited',
      respondentId: RESPONDENT,
      ownerInfo: info,
      currentQuestionCode: null,
    });
    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.invited',
        {
          questionnaireId: saved?.uuid,
          respondentId: RESPONDENT,
          kind: 'likert',
          ownerInfo: info,
        },
      ],
    ]);
  });
});
