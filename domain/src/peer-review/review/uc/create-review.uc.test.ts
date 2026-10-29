import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ReviewPolicy } from '../review.policy';
import { ReviewRules } from '../review.rules';
import { CreateReviewUcDef } from './create-review.uc';

const ID = '11111111-1111-4111-8111-111111111111';

describe('CreateReviewUcDef', () => {
  it('command пользователя над review; ошибки и событие', () => {
    const n = normalize(CreateReviewUcDef);
    expect(n).toMatchObject({
      name: 'createReview',
      type: 'command',
      aggregate: 'review',
      callers: ['user'],
      emits: ['peer-review.review.created'],
    });
    expect([...n.errors].sort()).toEqual(
      [
        'REVIEW_CAMPAIGN_NOT_FOUND',
        'REVIEW_RECIPIENT_NOT_ALLOWED',
        'REVIEW_TEXT_INVALID',
        'REVIEW_WINDOW_CLOSED',
      ].sort(),
    );
  });

  it('Policy — автор окна (право раньше правил)', () => {
    expect(CreateReviewUcDef.policy).toBe(ReviewPolicy.rules.isCampaignAuthor);
  });

  it('правила по порядку: окно → адресат → текст', () => {
    expect(CreateReviewUcDef.rules).toEqual([
      ReviewRules.rules.windowOpen,
      ReviewRules.rules.recipientAllowed,
      ReviewRules.rules.validText,
    ]);
  });

  it('вход — { campaignId, recipientId, text }, без authorId', () => {
    const { input } = CreateReviewUcDef;
    expect(
      v.safeParse(input, { campaignId: ID, recipientId: ID, text: 'текст' })
        .success,
    ).toBe(true);
    expect(
      v.safeParse(input, { campaignId: 'x', recipientId: ID, text: 'т' })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(input, { campaignId: ID, recipientId: ID }).success,
    ).toBe(false);
    expect(Object.keys((input as { entries: object }).entries).sort()).toEqual([
      'campaignId',
      'recipientId',
      'text',
    ]);
  });

  it('выход — { reviewId, campaignId, recipientId }', () => {
    const out = { reviewId: ID, campaignId: ID, recipientId: ID };
    expect(v.parse(CreateReviewUcDef.output, out)).toEqual(out);
    expect(
      v.safeParse(CreateReviewUcDef.output, { ...out, reviewId: 'x' }).success,
    ).toBe(false);
  });
});
