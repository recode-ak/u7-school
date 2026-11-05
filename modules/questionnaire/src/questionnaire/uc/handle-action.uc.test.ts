import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { HandleActionUc } from './handle-action.uc';
import {
  MISSING,
  makeEnv,
  OWNER_INFO,
  pool,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  respondent,
  state,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (handle-action) и ветвей `a-root`: completed
// публикуется при последнем вопросе.

let env: ReturnType<typeof makeEnv>;
type Action = { type: 'callback' | 'text'; value: string };
const run = (
  action: Action,
  caller: Caller<QuestionnaireUser> = respondent,
  questionnaireId: string = QUESTIONNAIRE,
) =>
  new HandleActionUc(env.deps, QuestionnaireModuleDef).handle(
    { questionnaireId, ...action },
    caller,
    REQ,
  );
const cb = (value: string): Action => ({ type: 'callback', value });

beforeEach(() => {
  env = makeEnv();
  env.seed(state('in_progress'));
});

describe('HandleActionUc', () => {
  it('выбор ответа → следующий вопрос; последний — completed с completionText и событием', async () => {
    env.seed(
      state('in_progress', {
        questionPool: { ...pool(), completionText: 'Спасибо!' },
      }),
    );
    const res = expectOk(await run(cb('yes')));
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q2');
    expect(env.stored()).toMatchObject({
      currentQuestionCode: 'q2',
      answers: [{ questionCode: 'q1', answerCode: 'yes', answeredAt: T0 }],
    });

    const done = expectOk(await run(cb('ok')));
    expect(done).toMatchObject({
      type: 'completed',
      completionText: 'Спасибо!',
    });
    expect(env.stored()).toMatchObject({
      status: 'completed',
      completedAt: T0,
      currentQuestionCode: null,
    });
    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.completed',
        {
          questionnaireId: QUESTIONNAIRE,
          respondentId: RESPONDENT,
          kind: 'standard',
          ownerInfo: OWNER_INFO,
        },
      ],
    ]);
  });

  it('вид действия photo — INPUT_VALIDATION, ответ не записан', async () => {
    expectErr(
      await run({ type: 'photo', value: 'x' } as never),
      'INPUT_VALIDATION',
    );
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.stored().answers).toEqual([]);
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(
      await run(cb('yes'), respondent, MISSING),
      'QUESTIONNAIRE_NOT_FOUND',
    );
  });
});
