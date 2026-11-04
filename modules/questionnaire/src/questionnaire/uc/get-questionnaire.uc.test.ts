import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetQuestionnaireUc } from './get-questionnaire.uc';
import {
  admin,
  anonymous,
  MISSING,
  makeEnv,
  OWNER_INFO,
  QUESTIONNAIRE,
  REQ,
  respondent,
  state,
  stranger,
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

  it('ничего не пишет и не публикует', async () => {
    await run();
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });

  it('админ читает чужую анкету', async () => {
    expect(expectOk(await run(admin)).uuid).toBe(QUESTIONNAIRE);
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    const error = expectErr(
      await run(respondent, MISSING),
      'QUESTIONNAIRE_NOT_FOUND',
    );
    expect(error.payload).toEqual({ questionnaireId: MISSING });
  });

  it('чужая анкета — ACCESS_DENIED «Нет доступа к анкете»', async () => {
    const error = expectErr(await run(stranger), 'ACCESS_DENIED');
    expect((error.payload as { denyMessage: string }).denyMessage).toBe(
      'Нет доступа к анкете',
    );
  });

  it('гость — UNAUTHORIZED', async () => {
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});
