import { describe, expect, it } from 'bun:test';
import { allowAll } from 'dmg-core';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ListMyReviewsUcDef } from './list-my-reviews.uc';

const ID = '11111111-1111-4111-8111-111111111111';
const snap = {
  reviewId: ID,
  scopeId: ID,
  authorId: ID,
  direction: 'student_mentor' as const,
  text: 'Текст',
  createdAt: 1_000,
};

describe('ListMyReviewsUcDef', () => {
  it('query пользователя, allowAll, без ошибок', () => {
    expect(normalize(ListMyReviewsUcDef)).toMatchObject({
      name: 'listMyReviews',
      type: 'query',
      aggregate: 'review',
      callers: ['user'],
      errors: [],
    });
    expect(ListMyReviewsUcDef.policy).toBe(allowAll);
  });

  it('вход — только необязательный filter, без userId', () => {
    const { input } = ListMyReviewsUcDef;
    expect(v.safeParse(input, {}).success).toBe(true);
    expect(Object.keys((input as { entries: object }).entries)).toEqual([
      'filter',
    ]);
  });

  it('ReviewFilter: direction, recipientId, campaignId — все необязательные', () => {
    const { input } = ListMyReviewsUcDef;
    expect(v.safeParse(input, { filter: {} }).success).toBe(true);
    expect(
      v.safeParse(input, {
        filter: {
          direction: 'student_mentor',
          recipientId: ID,
          campaignId: ID,
        },
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(input, { filter: { direction: 'mentor_mentor' } }).success,
    ).toBe(false);
    expect(v.safeParse(input, { filter: { campaignId: 'x' } }).success).toBe(
      false,
    );
  });

  it('выход — { reviews }, createdAt — число', () => {
    const { output } = ListMyReviewsUcDef;
    expect(v.parse(output, { reviews: [snap] })).toEqual({ reviews: [snap] });
    expect(
      v.safeParse(output, {
        reviews: [{ ...snap, createdAt: '2026-09-20T10:00' }],
      }).success,
    ).toBe(false);
  });
});
