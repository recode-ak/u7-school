import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import {
  admin,
  anonymous,
  likertState,
  MISSING,
  makeEnv,
  QUESTIONNAIRE,
  REQ,
  respondent,
  state,
  stranger,
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

  it('сбрасывает warnedAt и continueInvitedAt', async () => {
    env.seed(
      state('invited', {
        currentQuestionCode: null,
        warnedAt: T0,
        continueInvitedAt: T0,
      }),
    );
    await run();
    expect(env.stored().warnedAt).toBeUndefined();
    expect(env.stored().continueInvitedAt).toBeUndefined();
  });

  it('не публикует started (Т5)', async () => {
    await run();
    expect(env.ctx.published).toEqual([]);
  });

  it('likert-анкета запускается так же', async () => {
    env.seed(likertState('invited'));
    const res = expectOk(await run());
    expect(res.type === 'new_question' && res.question.questionCode).toBe('m1');
  });

  it('админ запускает чужую анкету', async () => {
    expect(expectOk(await run(admin)).type).toBe('new_question');
  });

  it.each(['in_progress', 'completed', 'abandoned'] as const)(
    'из %s — QUESTIONNAIRE_NOT_INVITED, записи нет',
    async (status) => {
      env.seed(state(status));
      const error = expectErr(await run(), 'QUESTIONNAIRE_NOT_INVITED');
      expect(error.kind).toBe('conflict');
      expect(env.questionnaires.saved).toEqual([]);
    },
  );

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND с questionnaireId', async () => {
    const error = expectErr(
      await run(respondent, MISSING),
      'QUESTIONNAIRE_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Анкета не найдена');
    expect(error.payload).toEqual({ questionnaireId: MISSING });
  });

  it('чужая анкета — ACCESS_DENIED «Нет доступа к анкете», ничего не записано', async () => {
    const error = expectErr(await run(stranger), 'ACCESS_DENIED');
    expect((error.payload as { denyMessage: string }).denyMessage).toBe(
      'Нет доступа к анкете',
    );
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('гость — UNAUTHORIZED', async () => {
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});
