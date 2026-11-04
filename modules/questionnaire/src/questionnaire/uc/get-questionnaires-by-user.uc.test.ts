import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetQuestionnairesByUserUc } from './get-questionnaires-by-user.uc';
import {
  ADMIN_USER,
  admin,
  anonymous,
  likertState,
  makeEnv,
  OTHER_QUESTIONNAIRE,
  OTHER_USER,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  respondent,
  state,
  stranger,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (get-questionnaires-by-user): свои — респонденту,
// любые — admin; порядок записей — как в файле.

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

  it('у пользователя без анкет — пустой список', async () => {
    expect(expectOk(await run(admin, ADMIN_USER))).toEqual([]);
  });

  it('admin читает список другого пользователя', async () => {
    expect(expectOk(await run(admin, RESPONDENT))).toHaveLength(2);
  });

  it('чужой список — ACCESS_DENIED «Нет доступа к списку анкет пользователя»', async () => {
    const error = expectErr(await run(stranger, RESPONDENT), 'ACCESS_DENIED');
    expect((error.payload as { denyMessage: string }).denyMessage).toBe(
      'Нет доступа к списку анкет пользователя',
    );
  });

  it('гость — UNAUTHORIZED', async () => {
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});
