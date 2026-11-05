import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { ReviewCampaignAr } from './review-campaign.ar';
import { ReviewCampaignRules } from './review-campaign.rules';

const SCOPE = '22222222-2222-4222-8222-222222222222';
const OTHER_SCOPE = '22222222-2222-4222-8222-222222222223';
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const OTHER_SUBJECT = '77777777-7777-4777-8777-777777777778';
const MENTOR = '55555555-5555-4555-8555-555555555555';

const campaign = (scopeId = SCOPE, subjectId = SUBJECT) =>
  ReviewCampaignAr.restore({
    uuid: crypto.randomUUID(),
    context: 'stream_fate',
    scopeId,
    subjectId,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
    expiresAt: 7 * 24 * 3600 * 1000,
    participants: [],
    payload: { subjectOutcome: 'dropped', mentorId: MENTOR },
  });

const { unique } = ReviewCampaignRules.rules;

describe('ReviewCampaignRules.unique (D-40, DOM-16)', () => {
  it('кампаний на пару нет — ok', () => {
    expectOk(
      unique.check({ scopeId: SCOPE, subjectId: SUBJECT, campaigns: [] }),
    );
  });

  it('есть кампания той же пары (scopeId, subjectId) — ALREADY_EXISTS (conflict)', () => {
    const error = expectErr(
      unique.check({
        scopeId: SCOPE,
        subjectId: SUBJECT,
        campaigns: [campaign()],
      }),
      'REVIEW_CAMPAIGN_ALREADY_EXISTS',
    );
    expect(error.kind).toBe('conflict');
  });

  it('другой скоуп или другой субъект — не мешает', () => {
    expectOk(
      unique.check({
        scopeId: SCOPE,
        subjectId: SUBJECT,
        campaigns: [campaign(OTHER_SCOPE), campaign(SCOPE, OTHER_SUBJECT)],
      }),
    );
  });
});
