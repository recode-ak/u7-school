import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import {
  MISSING,
  makeEnv,
  QUESTIONNAIRE,
  REQ,
  respondent,
  state,
  T0,
} from './questionnaire-uc.fixture';
import { StartByInviteUc } from './start-by-invite.uc';

// Перенос `api/module.test.ts` (start-by-invite). Событие started НЕ публикуется (Т5).

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new StartByInviteUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(state('invited', { currentQuestionCode: null }));
});

describe('StartByInviteUc', () => {
  it('invited → in_progress, возвращает первый вопрос', async () => {
    const res = expectOk(await run());
    expect(res.type).toBe('new_question');
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q1');
    expect(env.stored()).toMatchObject({
      status: 'in_progress',
      currentQuestionCode: 'q1',
      updatedAt: T0,
    });
  });

  it('не публикует started (Т5)', async () => {
    await run();
    expect(env.ctx.published).toEqual([]);
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(respondent, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });
});
