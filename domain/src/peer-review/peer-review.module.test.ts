import { describe, expect, it } from 'bun:test';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import * as contract from './contract';
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

  it('ArchChecker (checkDefs) — без нарушений', () => {
    expect(ArchChecker.defsOf([PeerReviewModuleDef]).report()).toEqual([]);
  });

  it('контракт отдаёт события, ошибки и 5 Def рецензий', () => {
    for (const name of [
      'ReviewEvents',
      'ReviewErrors',
      'CreateReviewUcDef',
      'GetMyReviewUcDef',
      'ListMyReviewsUcDef',
      'ListScopeReviewsUcDef',
      'ListScopeFactsUcDef',
    ]) {
      expect(contract).toHaveProperty(name);
    }
  });
});
