import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { PeerReviewModuleDef } from './peer-review.module';

describe('PeerReviewModuleDef — Def кампаний и отзывов, без external (MAN-06)', () => {
  it('паспорт: 2 агрегата, 7 UC, ER кампаний, dependsOn прежние', () => {
    const n = normalize(PeerReviewModuleDef);
    expect(PeerReviewModuleDef.external).toBeFalsy();
    expect(n).toMatchObject({
      name: 'peer-review',
      dependsOn: ['user', 'questionnaire', 'stream'],
      aggregates: ['review-campaign', 'review'],
      reactions: ['createStudentCampaign'],
      jobs: [],
    });
    expect([...n.useCases].sort()).toEqual(
      [
        'getMyCampaigns',
        'getCampaignRecipients',
        'createReview',
        'getMyReview',
        'listMyReviews',
        'listScopeReviews',
        'listScopeFacts',
      ].sort(),
    );
  });
});
