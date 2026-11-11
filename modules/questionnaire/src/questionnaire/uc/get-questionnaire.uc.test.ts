import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetQuestionnaireUc } from './get-questionnaire.uc';
import {
  MISSING,
  makeEnv,
  OWNER_INFO,
  QUESTIONNAIRE,
  REQ,
  respondent,
  state,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (get-questionnaire): вход `questionnaireId` (Т11), выход — вид.

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new GetQuestionnaireUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(state('in_progress', { updatedAt: T0 + 5 }));
});

describe('GetQuestionnaireUc', () => {
  it('отдаёт вид анкеты: state с датами-числами', async () => {
    const view = expectOk(await run());
    expect(view).toMatchObject({
      uuid: QUESTIONNAIRE,
      kind: 'standard',
      status: 'in_progress',
      ownerInfo: OWNER_INFO,
      createdAt: T0,
      updatedAt: T0 + 5,
    });
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    const error = expectErr(
      await run(respondent, MISSING),
      'QUESTIONNAIRE_NOT_FOUND',
    );
    expect(error.payload).toEqual({ questionnaireId: MISSING });
  });
});
