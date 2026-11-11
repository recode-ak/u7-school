import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import type { QuestionnairePool } from './question';
import { QuestionnairePoolSchema } from './question';

const minimal: QuestionnairePool = {
  questions: [
    {
      question: 'Q1',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'A', answerCode: 'a' }],
    },
  ],
};

type Row = { title: string; value: unknown; valid?: boolean };

describe('QuestionnairePool', () => {
  test.each<Row>([
    {
      title: 'принимает пул с минимальными полями',
      value: minimal,
      valid: true,
    },
    {
      title: 'принимает пул со всеми необязательными текстами',
      value: {
        inviteText: 'Приглашаем пройти опрос',
        whyText: 'Это поможет улучшить метрики',
        completionText: 'Спасибо за ответы!',
        cancelWarning: 'Метрики не будут обновлены',
        questions: minimal.questions,
      },
      valid: true,
    },
    {
      title: 'отклоняет пул без questions',
      value: { inviteText: 'Test' },
    },
    { title: 'отклоняет пустой questions', value: { questions: [] } },
    {
      title: 'отклоняет битый вопрос в пуле',
      value: {
        questions: [
          {
            question: '',
            questionCode: '',
            type: 'choice',
            multiple: false,
            answers: [],
          },
        ],
      },
    },
  ])('$title', ({ value, valid = false }) => {
    expect(v.safeParse(QuestionnairePoolSchema, value).success).toBe(valid);
  });
});
