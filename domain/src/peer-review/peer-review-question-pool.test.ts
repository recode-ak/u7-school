import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import {
  PEER_REVIEW_POOLS,
  PeerReviewQuestionPoolSchema,
} from './peer-review-question-pool';

const question = (questionCode = 'mc_work_quality_1') => ({
  questionCode,
  question: 'Пишет код чисто, читаемо и структурированно',
  skillMapping: {
    category: 'professional_skills',
    subcategory: 'work_quality',
    weight: 1,
  },
});

const cases: [string, unknown, boolean][] = [
  ['один вопрос', { questions: [question()] }, true],
  ['пустой questions', { questions: [] }, false],
  [
    'вес вне {0.75, 1, 1.25}',
    {
      questions: [
        {
          ...question(),
          skillMapping: {
            category: 'professional_skills',
            subcategory: 'work_quality',
            weight: 0.5,
          },
        },
      ],
    },
    false,
  ],
  ['пустой questionCode', { questions: [question('')] }, false],
];

describe('peer-review-question-pool', () => {
  test('схема пула: валидно/невалидно; questionCode уникальны внутри и между пулами', () => {
    for (const [name, pool, ok] of cases) {
      expect({
        name,
        ok: v.safeParse(PeerReviewQuestionPoolSchema, pool).success,
      }).toEqual({ name, ok });
    }

    const seen = new Set<string>();
    for (const pool of Object.values(PEER_REVIEW_POOLS)) {
      for (const q of pool.questions) {
        expect(seen.has(q.questionCode)).toBe(false);
        seen.add(q.questionCode);
      }
    }
  });
});
