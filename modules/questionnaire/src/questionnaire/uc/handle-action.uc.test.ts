import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import { HandleActionUc } from './handle-action.uc';
import {
  admin,
  anonymous,
  likertState,
  MISSING,
  makeEnv,
  OWNER_INFO,
  owner,
  pool,
  QUESTIONNAIRE,
  REQ,
  RESPONDENT,
  state,
  stranger,
  T0,
} from './questionnaire-uc.fixture';

// Перенос `api/module.test.ts` (handle-action, likert-complete) и ветвей `a-root`.
// completed публикуется при последнем вопросе; likert — с likertScores (Q1).

let env: ReturnType<typeof makeEnv>;
type Action = { type: 'callback' | 'text'; value: string };
const run = (
  action: Action,
  caller: Caller<QuestionnaireUser> = owner,
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
  it('выбор ответа: фиксирует ответ, возвращает следующий вопрос, событий нет', async () => {
    const res = expectOk(await run(cb('yes')));
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q2');
    expect(env.stored()).toMatchObject({
      currentQuestionCode: 'q2',
      answers: [{ questionCode: 'q1', answerCode: 'yes', answeredAt: T0 }],
    });
    expect(env.ctx.published).toEqual([]);
  });

  it('последний вопрос: completed с completionText, событие completed без answers', async () => {
    env.seed(
      state('in_progress', {
        questionPool: { ...pool(), completionText: 'Спасибо!' },
      }),
    );
    await run(cb('yes'));
    const res = expectOk(await run(cb('ok')));

    expect(res).toMatchObject({
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

  it('likert: completed с likertScores и ownerInfo', async () => {
    const likert = likertState('in_progress');
    env.seed(likert);
    await run(cb('4'));
    expect(expectOk(await run(cb('2'))).type).toBe('completed');

    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.completed',
        {
          questionnaireId: QUESTIONNAIRE,
          respondentId: RESPONDENT,
          kind: 'likert',
          ownerInfo: likert.ownerInfo,
          likertScores: [
            {
              category: 'professional_skills',
              subcategory: 'work_quality',
              score: 4,
            },
            {
              category: 'professional_skills',
              subcategory: 'algorithmic_thinking',
              score: 2,
            },
          ],
        },
      ],
    ]);
  });

  it('устаревший ответ — stale_answer как успех, ответ записан без смены ответов', async () => {
    const res = expectOk(await run(cb('alien')));
    expect(res).toMatchObject({ type: 'stale_answer', reason: 'stale_button' });
    expect(env.stored().answers).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });

  it('text на choice-вопросе — QUESTIONNAIRE_CHOICE_EXPECTED, записи нет', async () => {
    const error = expectErr(
      await run({ type: 'text', value: 'привет' }),
      'QUESTIONNAIRE_CHOICE_EXPECTED',
    );
    expect(error.kind).toBe('validation');
    expect(env.questionnaires.saved).toEqual([]);
  });

  it('пустой код ответа — QUESTIONNAIRE_EMPTY_ANSWER_CODE', async () => {
    const error = expectErr(
      await run(cb('')),
      'QUESTIONNAIRE_EMPTY_ANSWER_CODE',
    );
    expect(error.label).toBe('Код ответа не может быть пустым');
    expect(env.questionnaires.saved).toEqual([]);
  });

  it.each(['invited', 'completed', 'abandoned'] as const)(
    'анкета %s — QUESTIONNAIRE_NOT_IN_PROGRESS «Анкета уже завершена»',
    async (status) => {
      env.seed(state(status));
      const error = expectErr(
        await run(cb('yes')),
        'QUESTIONNAIRE_NOT_IN_PROGRESS',
      );
      expect(error.label).toBe('Анкета уже завершена');
    },
  );

  it('админ отвечает за респондента', async () => {
    expect(expectOk(await run(cb('yes'), admin)).type).toBe('new_question');
  });

  it('анкеты нет — QUESTIONNAIRE_NOT_FOUND', async () => {
    expectErr(await run(cb('yes'), owner, MISSING), 'QUESTIONNAIRE_NOT_FOUND');
  });

  it('чужая анкета — ACCESS_DENIED «Нет доступа к анкете», ответов нет', async () => {
    const error = expectErr(await run(cb('yes'), stranger), 'ACCESS_DENIED');
    expect((error.payload as { denyMessage: string }).denyMessage).toBe(
      'Нет доступа к анкете',
    );
    expect(env.stored().answers).toEqual([]);
  });

  it('гость — UNAUTHORIZED', async () => {
    expectErr(await run(cb('yes'), anonymous), 'UNAUTHORIZED');
  });
});
