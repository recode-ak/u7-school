import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { ReviewArDef } from './review.ar';
import {
  REVIEW_TEXT_MAX_LENGTH,
  REVIEW_TEXT_MIN_LENGTH,
  ReviewDirectionSchema,
  ReviewState,
} from './review.state';

// Перенос `entity.test.ts` (ReviewSchema → ReviewArDef.state) + legacy-записи (D-36).

const UUIDS = {
  review: '11111111-1111-4111-8111-111111111111',
  scope: '12222222-2222-4222-8222-222222222222',
  campaign: '22222222-2222-4222-8222-222222222222',
  author: '33333333-3333-4333-8333-333333333333',
  recipient: '44444444-4444-4444-8444-444444444444',
};

/** Legacy-запись как в `reviews.json` релиза: ISO без зоны, без `updatedAt` и `version`. */
function legacy(overrides: Record<string, unknown> = {}) {
  return {
    uuid: UUIDS.review,
    scopeId: UUIDS.scope,
    campaignId: UUIDS.campaign,
    authorId: UUIDS.author,
    direction: 'student_student',
    authorOutcome: 'completed_passed',
    recipientId: UUIDS.recipient,
    text: 'Ровный текст отзыва достаточной длины.',
    createdAt: '2026-09-20T12:00',
    ...overrides,
  };
}

const parse = (input: unknown) => v.safeParse(ReviewArDef.state, input);

describe('ReviewDirectionSchema', () => {
  test('принимает три направления «кто о ком»', () => {
    for (const direction of [
      'student_student',
      'student_mentor',
      'mentor_student',
    ]) {
      expect(v.safeParse(ReviewDirectionSchema, direction).success).toBe(true);
    }
  });

  test('невозможная пара mentor_mentor исключена типом', () => {
    expect(v.safeParse(ReviewDirectionSchema, 'mentor_mentor').success).toBe(
      false,
    );
  });
});

describe('ReviewArDef.state — legacy-запись (D-36)', () => {
  test('ISO без зоны читается как UTC-число; updatedAt = createdAt; version = 0', () => {
    const res = parse(legacy());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.output.createdAt).toBe(Date.UTC(2026, 8, 20, 12));
    expect(res.output.updatedAt).toBe(Date.UTC(2026, 8, 20, 12));
    expect(res.output.version).toBe(0);
  });

  test('updatedAt из записи (ISO) — число, createdAt не затронут', () => {
    const res = parse(legacy({ updatedAt: '2026-09-21T15:30' }));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.output.updatedAt).toBe(Date.UTC(2026, 8, 21, 15, 30));
    expect(res.output.createdAt).toBe(Date.UTC(2026, 8, 20, 12));
  });

  test('запись ментора без authorOutcome читается, исхода нет', () => {
    const res = parse(
      legacy({ direction: 'mentor_student', authorOutcome: undefined }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.output.authorOutcome).toBeUndefined();
  });

  test('новый формат (числа, version) читается без изменений', () => {
    const next = legacy({
      createdAt: Date.UTC(2026, 8, 20, 12),
      updatedAt: Date.UTC(2026, 8, 21, 12),
      version: 3,
    });
    const res = parse(next);
    expect(res.success).toBe(true);
    if (res.success) expect(res.output).toEqual(next as never);
  });
});

describe('ReviewState — форма', () => {
  test('валидный отзыв студента', () => {
    expect(parse(legacy()).success).toBe(true);
  });

  test('снапшоты кампании обязательны: campaignId, direction', () => {
    expect(parse(legacy({ campaignId: 'x' })).success).toBe(false);
    expect(parse(legacy({ direction: 'student_teacher' })).success).toBe(false);
    expect(parse(legacy({ direction: undefined })).success).toBe(false);
  });

  test('uuid, scopeId, authorId, recipientId — UUID', () => {
    for (const key of ['uuid', 'scopeId', 'authorId', 'recipientId']) {
      expect(parse(legacy({ [key]: 'x' })).success).toBe(false);
      expect(parse(legacy({ [key]: undefined })).success).toBe(false);
    }
  });

  test('authorOutcome — только 4-значные проекции', () => {
    for (const outcome of [
      'completed_passed',
      'completed_not_passed',
      'dropped',
      'never_started',
    ]) {
      expect(parse(legacy({ authorOutcome: outcome })).success).toBe(true);
    }
    for (const outcome of ['advanced', 'in_progress', 'completed']) {
      expect(parse(legacy({ authorOutcome: outcome })).success).toBe(false);
    }
  });

  test('дата не ISO и не число отклоняется', () => {
    expect(parse(legacy({ createdAt: '20.09.2026' })).success).toBe(false);
    expect(parse(legacy({ updatedAt: 'вчера' })).success).toBe(false);
  });

  test('у каждого поля есть описание (MAN-02)', () => {
    for (const field of Object.values(ReviewState.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });

  test('поля state: база entity + поля отзыва', () => {
    expect(Object.keys(ReviewState.entries).sort()).toEqual(
      [
        'uuid',
        'createdAt',
        'updatedAt',
        'version',
        'scopeId',
        'campaignId',
        'authorId',
        'direction',
        'authorOutcome',
        'recipientId',
        'text',
      ].sort(),
    );
  });
});

describe('ReviewState — длина текста', () => {
  test('константы: 10 и 3500', () => {
    expect(REVIEW_TEXT_MIN_LENGTH).toBe(10);
    expect(REVIEW_TEXT_MAX_LENGTH).toBe(3500);
  });

  test('короче минимума — отказ с сообщением «Отзыв слишком короткий»', () => {
    const res = parse(legacy({ text: 'а'.repeat(REVIEW_TEXT_MIN_LENGTH - 1) }));
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.map((i) => i.message)).toContain(
        'Отзыв слишком короткий',
      );
    }
  });

  test('ровно минимум и ровно максимум — валидны', () => {
    expect(
      parse(legacy({ text: 'а'.repeat(REVIEW_TEXT_MIN_LENGTH) })).success,
    ).toBe(true);
    expect(
      parse(legacy({ text: 'а'.repeat(REVIEW_TEXT_MAX_LENGTH) })).success,
    ).toBe(true);
  });

  test('длиннее максимума — отказ с сообщением «Отзыв слишком длинный»', () => {
    const res = parse(legacy({ text: 'а'.repeat(REVIEW_TEXT_MAX_LENGTH + 1) }));
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.issues.map((i) => i.message)).toContain(
        'Отзыв слишком длинный',
      );
    }
  });
});
