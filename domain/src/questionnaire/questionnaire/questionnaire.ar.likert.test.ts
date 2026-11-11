import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { QuestionnaireAr } from './questionnaire.ar';
import { QuestionnaireEvents } from './questionnaire.events';
import {
  LIKERT_OWNER_INFO,
  likertInput,
  likertPool,
  QUESTIONNAIRE,
  RESPONDENT,
  T0,
} from './questionnaire.fixture';

// Перенос `likert/likert-questionnaire-ar.test.ts`: likert — ветка `kind` в
// `QuestionnaireAr`; `likertScores` и `ownerInfo` идут в событие completed.

const mapping = (
  subcategory: string,
  weight: number,
  category = 'team_skills',
) => ({
  category,
  subcategory,
  weight,
});
const q = (code: string, m: ReturnType<typeof mapping>) => ({
  questionCode: code,
  question: `Вопрос ${code}`,
  likertMapping: m,
});

function run(
  pool = likertPool(),
  answers: string[],
  info: Record<string, unknown> = LIKERT_OWNER_INFO,
) {
  const ar = expectOk(
    QuestionnaireAr.createLikert(likertInput(pool, info), T0),
  );
  ar.pullEvents();
  expectOk(ar.start(T0 + 1));
  let last: ReturnType<QuestionnaireAr['handleAction']> | undefined;
  answers.forEach((value, i) => {
    last = ar.handleAction(T0 + 10 + i, { type: 'callback', value });
  });
  return { ar, last };
}

describe('QuestionnaireAr (likert) — завершение', () => {
  it('вычисляет likertScores и кладёт ownerInfo и kind в completed; answers в событии нет', () => {
    const { ar, last } = run(likertPool(), ['4', '2']);
    expect(last && expectOk(last).type).toBe('completed');
    const events = ar.pullEvents();
    expect(events).toEqual([
      QuestionnaireEvents.completed.make({
        questionnaireId: QUESTIONNAIRE,
        respondentId: RESPONDENT,
        kind: 'likert',
        ownerInfo: LIKERT_OWNER_INFO,
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
      }),
    ]);
    expect(events[0]?.payload).not.toHaveProperty('answers');
  });

  it('разный вес даёт средневзвешенное: (5·0.75 + 1·1.25) / 2 = 2.5', () => {
    const pool = likertPool([
      q('a', mapping('communication', 0.75)),
      q('b', mapping('communication', 1.25)),
    ]);
    const { ar } = run(pool, ['5', '1']);
    expect(ar.pullEvents()[0]?.payload).toMatchObject({
      likertScores: [
        { category: 'team_skills', subcategory: 'communication', score: 2.5 },
      ],
    });
  });
});

describe('QuestionnaireAr (likert) — вопросы по шкале Лайкерта', () => {
  it('LikertQuestion → choice без multiple, пять вариантов 1..5', () => {
    const ar = expectOk(QuestionnaireAr.createLikert(likertInput(), T0));
    expectOk(ar.start(T0 + 1));
    const screen = ar.screen();
    expect(screen.type).toBe('new_question');
    if (screen.type === 'new_question' && screen.question.type === 'choice') {
      expect(screen.question.multiple).toBe(false);
      expect(screen.question.answers).toHaveLength(5);
      expect(screen.question.answers[0]?.answerCode).toBe('1');
      expect(screen.question.answers[4]?.answerCode).toBe('5');
    } else {
      throw new Error('ожидался choice-вопрос');
    }
  });
});
