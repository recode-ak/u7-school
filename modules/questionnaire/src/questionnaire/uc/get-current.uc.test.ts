import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetCurrentUc } from './get-current.uc';
import {
  MISSING,
  makeEnv,
  QUESTIONNAIRE,
  REQ,
  respondent,
  state,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (get-current) и ветвей `getQuestionnaireActionResponse`.

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new GetCurrentUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
});

describe('GetCurrentUc', () => {
  it('in_progress → new_question с текущим вопросом', async () => {
    env.seed(state('in_progress'));
    const res = expectOk(await run());
    expect(res.type).toBe('new_question');
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q1');
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(respondent, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });
});
