import { describe, expect, test } from 'bun:test';
import { ReviewAr } from './review.ar';
import type { ReviewState } from './review.state';
import { ScopeReviewsDqs } from './scope-reviews.dqs';

// Перенос `scope-reviews-ds.test.ts` (ScopeReviewsDs → ScopeReviewsDqs); createdAt — число.
// Допущение: DQS принимает Ar (репозиторий отдаёт Ar), как CampaignFactsDqs.

const SCOPE = '22222222-2222-4222-8222-222222222222';
const ALICE = '33333333-3333-4333-8333-333333333333';
const BOB = '44444444-4444-4444-8444-444444444444';
const MENTOR = '55555555-5555-4555-8555-555555555555';
const H = (hour: number) => Date.UTC(2026, 8, 20, hour);

function review(uuid: string, over: Partial<ReviewState>): ReviewAr {
  const createdAt = over.createdAt ?? H(11);
  return ReviewAr.restore({
    uuid,
    scopeId: SCOPE,
    campaignId: '11111111-1111-4111-8111-111111111111',
    authorId: ALICE,
    direction: 'student_mentor',
    authorOutcome: 'completed_passed',
    recipientId: MENTOR,
    text: 'Текст отзыва достаточной длины.',
    createdAt,
    updatedAt: createdAt,
    version: 0,
    ...over,
  });
}

describe('ScopeReviewsDqs.groupByRecipient', () => {
  test('группы по адресатам в порядке первого появления, отзывы по createdAt', () => {
    const groups = new ScopeReviewsDqs([
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', { recipientId: MENTOR }),
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', {
        recipientId: BOB,
        direction: 'student_student',
        createdAt: H(12),
      }),
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', {
        recipientId: BOB,
        direction: 'mentor_student',
        authorId: MENTOR,
        authorOutcome: undefined,
        createdAt: H(10),
      }),
    ]).groupByRecipient();

    // порядок групп — по первому появлению ПОСЛЕ сортировки по createdAt
    expect(groups.map((g) => g.recipientId)).toEqual([BOB, MENTOR]);
    const bob = groups[0]!;
    expect(bob.reviews.map((r) => r.createdAt)).toEqual([H(10), H(12)]);
    expect(bob.reviews[0]).toEqual({
      reviewId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003',
      scopeId: SCOPE,
      authorId: MENTOR,
      direction: 'mentor_student',
      text: 'Текст отзыва достаточной длины.',
      createdAt: H(10),
    });
  });

  test('снимок студента несёт authorOutcome', () => {
    const [group] = new ScopeReviewsDqs([
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', {}),
    ]).groupByRecipient();
    expect(group?.reviews[0]?.authorOutcome).toBe('completed_passed');
  });

  test('равный createdAt — порядок по uuid', () => {
    const [group] = new ScopeReviewsDqs([
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000009', {}),
      review('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', {}),
    ]).groupByRecipient();
    expect(group?.reviews.map((r) => r.reviewId)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000009',
    ]);
  });
});
