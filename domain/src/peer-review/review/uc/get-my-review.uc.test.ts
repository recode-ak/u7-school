import { describe, expect, it } from 'bun:test';
import { allowAll } from 'dmg-core';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetMyReviewUcDef } from './get-my-review.uc';

const ID = '11111111-1111-4111-8111-111111111111';

describe('GetMyReviewUcDef', () => {
  it('query пользователя, allowAll, без ошибок', () => {
    expect(normalize(GetMyReviewUcDef)).toMatchObject({
      name: 'getMyReview',
      type: 'query',
      aggregate: 'review',
      callers: ['user'],
      errors: [],
    });
    expect(GetMyReviewUcDef.policy).toBe(allowAll);
  });

  it('вход — { campaignId, recipientId }, без authorId', () => {
    const { input } = GetMyReviewUcDef;
    expect(
      v.safeParse(input, { campaignId: ID, recipientId: ID }).success,
    ).toBe(true);
    expect(v.safeParse(input, { campaignId: ID }).success).toBe(false);
    expect(Object.keys((input as { entries: object }).entries).sort()).toEqual([
      'campaignId',
      'recipientId',
    ]);
  });

  it('выход — { found, text? }', () => {
    const { output } = GetMyReviewUcDef;
    expect(v.parse(output, { found: false })).toEqual({ found: false });
    expect(v.parse(output, { found: true, text: 'Текст' })).toEqual({
      found: true,
      text: 'Текст',
    });
    expect(v.safeParse(output, {}).success).toBe(false);
  });
});
