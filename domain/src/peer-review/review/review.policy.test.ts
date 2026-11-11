import { describe, expect, it } from 'bun:test';
import { allowed } from 'dmg-core';
import { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';
import { ReviewPolicy } from './review.policy';

const SUBJECT = '77777777-7777-4777-8777-777777777777';
const MENTOR = '55555555-5555-4555-8555-555555555555';
const ALICE = '33333333-3333-4333-8333-333333333333';
const STRANGER = '29999999-9999-4999-8999-999999999999';

const ctx = {
  campaign: ReviewCampaignAr.restore({
    uuid: '11111111-1111-4111-8111-111111111111',
    context: 'stream_fate',
    scopeId: '22222222-2222-4222-8222-222222222222',
    subjectId: SUBJECT,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
    expiresAt: 1,
    participants: [ALICE],
    payload: { subjectOutcome: 'completed_passed', mentorId: MENTOR },
  }),
};
const user = (uuid: string) => ({ uuid });
const { isCampaignAuthor } = ReviewPolicy.rules;

describe('ReviewPolicy.isCampaignAuthor', () => {
  it('субъект окна — allowed', () => {
    expect(isCampaignAuthor.evaluate(user(SUBJECT), ctx)).toEqual(allowed);
  });

  it('ментор окна — allowed', () => {
    expect(isCampaignAuthor.evaluate(user(MENTOR), ctx)).toEqual(allowed);
  });

  it('адресуемый соученик — denied', () => {
    const decision = isCampaignAuthor.evaluate(user(ALICE), ctx);
    expect(decision.allowed).toBe(false);
    expect(decision).toMatchObject({ rule: 'isCampaignAuthor' });
  });

  it('посторонний — denied', () => {
    expect(isCampaignAuthor.evaluate(user(STRANGER), ctx).allowed).toBe(false);
  });

  it('без субъекта — denied', () => {
    expect(isCampaignAuthor.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
