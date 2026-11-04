import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  likertPool,
  makeEnv,
  OTHER_USER,
  REQ,
  RESPONDENT,
  systemAlone,
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
const run = (caller = systemFor()) =>
  new SendLikertInviteUc(env.deps, QuestionnaireModuleDef).handle(
    { pool: likertPool(), ownerInfo: info },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
});

describe('SendLikertInviteUc', () => {
  it('создаёт likert-анкету invited за субъекта вызова', async () => {
    expect(expectOk(await run())).toEqual({});
    expect(env.questionnaires.saved[0]).toMatchObject({
      kind: 'likert',
      status: 'invited',
      respondentId: RESPONDENT,
      ownerInfo: info,
      currentQuestionCode: null,
    });
  });

  it('публикует invited с kind likert и ownerInfo', async () => {
    await run();
    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.invited',
        {
          questionnaireId: env.questionnaires.saved[0]?.uuid,
          respondentId: RESPONDENT,
          kind: 'likert',
          ownerInfo: info,
        },
      ],
    ]);
  });

  it('системный вызов без человека — ACCESS_DENIED, ничего не записано', async () => {
    expectErr(await run(systemAlone), 'ACCESS_DENIED');
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });
});
