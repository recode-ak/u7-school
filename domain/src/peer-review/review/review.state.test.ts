import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { ReviewArDef } from './review.ar';
import {
  REVIEW_TEXT_MAX_LENGTH,
  REVIEW_TEXT_MIN_LENGTH,
  ReviewDirectionSchema,
} from './review.state';

// Перенос `entity.test.ts` (ReviewSchema → ReviewArDef.state) + фолбэки дат (D-36).

const UUIDS = {
  review: '11111111-1111-4111-8111-111111111111',
  scope: '12222222-2222-4222-8222-222222222222',
  campaign: '22222222-2222-4222-8222-222222222222',
  author: '33333333-3333-4333-8333-333333333333',
  recipient: '44444444-4444-4444-8444-444444444444',
};

/** Запись как в `reviews.json`: даты числом, без `updatedAt` и `version`. */
function record(overrides: Record<string, unknown> = {}) {
  return {
    uuid: UUIDS.review,
    scopeId: UUIDS.scope,
    campaignId: UUIDS.campaign,
    authorId: UUIDS.author,
    direction: 'student_student',
    authorOutcome: 'completed_passed',
    recipientId: UUIDS.recipient,
    text: 'Ровный текст отзыва достаточной длины.',
    createdAt: Date.UTC(2026, 8, 20, 12),
    ...overrides,
  };
}

const parse = (input: unknown) => v.safeParse(ReviewArDef.state, input);

describe('ReviewDirectionSchema', () => {
  test('три направления «кто о ком» валидны, mentor_mentor — невалидно', () => {
    const cases: [string, boolean][] = [
      ['student_student', true],
      ['student_mentor', true],
      ['mentor_student', true],
      ['mentor_mentor', false],
    ];
    for (const [direction, ok] of cases) {
      expect({
        direction,
        ok: v.safeParse(ReviewDirectionSchema, direction).success,
      }).toEqual({
        direction,
        ok,
      });
    }
  });
});

describe('ReviewState — даты', () => {
  test('ISO-строка в дате отвергается', () => {
    expect(parse(record({ createdAt: '2026-09-20T12:00' })).success).toBe(
      false,
    );
  });
});

describe('ReviewState — форма', () => {
  test('authorOutcome — только 4-значные проекции', () => {
    for (const outcome of [
      'completed_passed',
      'completed_not_passed',
      'dropped',
      'never_started',
    ]) {
      expect(parse(record({ authorOutcome: outcome })).success).toBe(true);
    }
    for (const outcome of ['advanced', 'in_progress', 'completed']) {
      expect(parse(record({ authorOutcome: outcome })).success).toBe(false);
    }
  });
});

describe('ReviewState — длина текста', () => {
  test('короче минимума — отказ с сообщением «Отзыв слишком короткий»', () => {
    const res = parse(record({ text: 'а'.repeat(REVIEW_TEXT_MIN_LENGTH - 1) }));
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.map((i) => i.message)).toContain(
        'Отзыв слишком короткий',
      );
    }
  });

  test('ровно минимум и ровно максимум — валидны', () => {
    expect(
      parse(record({ text: 'а'.repeat(REVIEW_TEXT_MIN_LENGTH) })).success,
    ).toBe(true);
    expect(
      parse(record({ text: 'а'.repeat(REVIEW_TEXT_MAX_LENGTH) })).success,
    ).toBe(true);
  });

  test('длиннее максимума — отказ с сообщением «Отзыв слишком длинный»', () => {
    const res = parse(record({ text: 'а'.repeat(REVIEW_TEXT_MAX_LENGTH + 1) }));
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.map((i) => i.message)).toContain(
        'Отзыв слишком длинный',
      );
    }
  });
});
