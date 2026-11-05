import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetQuestionnairesByUserUc } from './get-questionnaires-by-user.uc';
import {
  likertState,
  makeEnv,
  OTHER_QUESTIONNAIRE,
  OTHER_USER,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  respondent,
  state,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (get-questionnaires-by-user): свои — респонденту;
// порядок записей — как в файле.

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  userId: string = RESPONDENT,
) =>
  new GetQuestionnairesByUserUc(env.deps, QuestionnaireModuleDef).handle(
    { userId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(
    state('completed', { completedAt: T0 }),
    likertState('invited', { uuid: OTHER_QUESTIONNAIRE }),
    state('in_progress', {
      uuid: '00000000-0000-4000-8000-000000000044',
      respondentId: OTHER_USER,
    }),
  );
});

describe('GetQuestionnairesByUserUc', () => {
  it('отдаёт анкеты респондента обеих веток kind в порядке записи, чужих нет', async () => {
    const list = expectOk(await run());
    expect(list.map((q) => [q.uuid, q.kind])).toEqual([
      [QUESTIONNAIRE, 'standard'],
      [OTHER_QUESTIONNAIRE, 'likert'],
    ]);
  });
});
