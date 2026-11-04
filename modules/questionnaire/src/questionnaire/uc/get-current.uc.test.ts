import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { GetCurrentUc } from './get-current.uc';
import {
  admin,
  anonymous,
  MISSING,
  makeEnv,
  owner,
  QUESTIONNAIRE,
  REQ,
  state,
  stranger,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (get-current) и ветвей `getQuestionnaireActionResponse`.

let env: ReturnType<typeof makeEnv>;
const run = (
  caller: Caller<QuestionnaireUser> = owner,
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
  it('invited → invited с inviteText и whyText', async () => {
    env.seed(state('invited', { currentQuestionCode: null }));
    expect(expectOk(await run())).toMatchObject({
      type: 'invited',
      questionnaireId: QUESTIONNAIRE,
      inviteText: 'Приглашаем пройти опрос',
      whyText: 'Это улучшит твои метрики',
    });
  });

  it('in_progress → new_question с текущим вопросом', async () => {
    env.seed(state('in_progress'));
    const res = expectOk(await run());
    expect(res.type).toBe('new_question');
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q1');
  });

  it('multiple с выбранными → wait_next', async () => {
    env.seed(
      state('in_progress', {
        currentQuestionCode: 'm',
        draftAnswers: { m: 'a' },
        questionPool: {
          questions: [
            {
              question: 'M',
              questionCode: 'm',
              type: 'choice',
              multiple: true,
              answers: [
                { answer: 'A', answerCode: 'a' },
                { answer: 'B', answerCode: 'b' },
              ],
            },
          ],
        },
      }),
    );
    expect(expectOk(await run())).toMatchObject({
      type: 'wait_next',
      selectedAnswers: ['a'],
    });
  });

  it.each(['completed', 'abandoned'] as const)(
    '%s → { type: completed }',
    async (status) => {
      env.seed(
        state(status, { completedAt: status === 'completed' ? T0 : null }),
      );
      expect(expectOk(await run())).toEqual({
        type: 'completed',
        questionnaireId: QUESTIONNAIRE,
      });
    },
  );

  it('ничего не пишет', async () => {
    env.seed(state('in_progress'));
    await run();
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(owner, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });

  it('чужая анкета — ACCESS_DENIED, админ читает', async () => {
    env.seed(state('in_progress'));
    expectErr(await run(stranger), 'ACCESS_DENIED');
    expect(expectOk(await run(admin)).type).toBe('new_question');
  });

  it('гость — UNAUTHORIZED', async () => {
    env.seed(state('in_progress'));
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});
