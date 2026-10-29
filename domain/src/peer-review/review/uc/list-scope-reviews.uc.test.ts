import { describe, expect, it } from 'bun:test';
import { allowAll } from 'dmg-core';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ListScopeReviewsUcDef } from './list-scope-reviews.uc';

const ID = '11111111-1111-4111-8111-111111111111';
const snap = {
  reviewId: ID,
  scopeId: ID,
  authorId: ID,
  direction: 'student_mentor' as const,
  text: 'Текст',
  createdAt: 1_000,
};

describe('ListScopeReviewsUcDef', () => {
  it('query пользователя, allowAll, без ошибок', () => {
    expect(normalize(ListScopeReviewsUcDef)).toMatchObject({
      name: 'listScopeReviews',
      type: 'query',
      aggregate: 'review',
      callers: ['user'],
      errors: [],
    });
    expect(ListScopeReviewsUcDef.policy).toBe(allowAll);
  });

  it('вход — { scopeIds, filter? }; пустой scopeIds допустим; direction вне фильтра нет', () => {
    const { input } = ListScopeReviewsUcDef;
    expect(v.safeParse(input, { scopeIds: [] }).success).toBe(true);
    expect(v.safeParse(input, { scopeIds: [ID] }).success).toBe(true);
    expect(v.safeParse(input, { scopeIds: ['x'] }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
    expect(Object.keys((input as { entries: object }).entries).sort()).toEqual([
      'filter',
      'scopeIds',
    ]);
  });

  it('ReviewFilter: direction, recipientId, campaignId', () => {
    const { input } = ListScopeReviewsUcDef;
    expect(
      v.safeParse(input, {
        scopeIds: [ID],
        filter: {
          direction: 'student_student',
          recipientId: ID,
          campaignId: ID,
        },
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(input, { scopeIds: [ID], filter: { direction: 'x' } })
        .success,
    ).toBe(false);
  });

  it('выход — { scopeIds, recipients[{ recipientId, reviews }] }, createdAt — число', () => {
    const { output } = ListScopeReviewsUcDef;
    const out = {
      scopeIds: [ID],
      recipients: [{ recipientId: ID, reviews: [snap] }],
    };
    expect(v.parse(output, out)).toEqual(out);
    expect(
      v.safeParse(output, {
        ...out,
        recipients: [
          {
            recipientId: ID,
            reviews: [{ ...snap, createdAt: '2026-09-20T10:00' }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
