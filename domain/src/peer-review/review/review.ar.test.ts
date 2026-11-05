import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { ReviewAr } from './review.ar';
import { ReviewEvents } from './review.events';
import type { ReviewState } from './review.state';

// Перенос `a-root.test.ts`: время — аргументом `at`, uuid — на входе (без Date.now и crypto).

const U = {
  review: '11111111-1111-4111-8111-111111111111',
  scope: '22222222-2222-4222-8222-222222222222',
  campaign: '33333333-3333-4333-8333-333333333333',
  alice: '44444444-4444-4444-8444-444444444444',
  bob: '55555555-5555-4555-8555-555555555555',
  mentor: '66666666-6666-4666-8666-666666666666',
};
const AT = Date.UTC(2026, 8, 21, 9, 30, 45, 123);
const LATER = AT + 3_600_000;
const TEXT = 'Крепкий одногруппник, надёжный в команде.';

const input = (over: Record<string, unknown> = {}) => ({
  uuid: U.review,
  campaignId: U.campaign,
  scopeId: U.scope,
  authorId: U.alice,
  direction: 'student_student' as const,
  authorOutcome: 'completed_passed' as const,
  recipientId: U.bob,
  text: TEXT,
  ...over,
});

const stored = (over: Partial<ReviewState> = {}): ReviewState => ({
  uuid: U.review,
  scopeId: U.scope,
  campaignId: U.campaign,
  authorId: U.alice,
  direction: 'student_student',
  authorOutcome: 'completed_passed',
  recipientId: U.bob,
  text: TEXT,
  createdAt: AT,
  updatedAt: AT,
  version: 0,
  ...over,
});

describe('ReviewAr.create', () => {
  it('direction и снимок исхода автора сохраняются; version 0', () => {
    const ar = expectOk(ReviewAr.create(input(), AT));
    expect(ar.snapshot()).toEqual(stored());
    expect(ar.campaignId).toBe(U.campaign);
    expect(ar.scopeId).toBe(U.scope);
    expect(ar.authorId).toBe(U.alice);
    expect(ar.recipientId).toBe(U.bob);
    expect(ar.direction).toBe('student_student');
    expect(ar.authorOutcome).toBe('completed_passed');
    expect(ar.text).toBe(TEXT);
  });

  it('автор-ментор — mentor_student, без исхода автора', () => {
    const ar = expectOk(
      ReviewAr.create(
        input({
          authorId: U.mentor,
          direction: 'mentor_student',
          authorOutcome: undefined,
        }),
        AT,
      ),
    );
    expect(ar.direction).toBe('mentor_student');
    expect(ar.authorOutcome).toBeUndefined();
  });

  it('событие created: peer-review.review.created с полным payload, выдаётся единожды', () => {
    const ar = expectOk(ReviewAr.create(input(), AT));
    expect(ar.pullEvents()).toEqual([
      ReviewEvents.created.make({
        reviewId: U.review,
        campaignId: U.campaign,
        scopeId: U.scope,
        authorId: U.alice,
        recipientId: U.bob,
        direction: 'student_student',
      }),
    ]);
    expect(ar.pullEvents()).toEqual([]);
  });
});

describe('ReviewAr.overwrite', () => {
  it('заменяет текст и обновляет updatedAt; uuid, createdAt, направление, исход сохраняются', () => {
    const ar = ReviewAr.restore(stored());
    const text = 'Дополненный отзыв: вырос в командной работе.';
    expectOk(ar.overwrite(text, LATER));
    expect(ar.text).toBe(text);
    expect(ar.snapshot()).toEqual(
      stored({ text, updatedAt: LATER, version: 1 }),
    );
  });

  it('перезапись события не создаёт', () => {
    const ar = expectOk(ReviewAr.create(input(), AT));
    ar.pullEvents();
    expectOk(ar.overwrite('Другой текст отзыва после правки.', LATER));
    expect(ar.pullEvents()).toEqual([]);
  });
});
