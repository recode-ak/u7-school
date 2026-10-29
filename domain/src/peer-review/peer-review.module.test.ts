import { describe, expect, it } from 'bun:test';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import { PeerReviewModuleDef } from './peer-review.module';

describe('PeerReviewModuleDef — Def кампаний, без external (MAN-06)', () => {
  it('паспорт: dependsOn прежние, агрегат кампании, 2 UC, 1 ER; UC рецензий пока legacy', () => {
    expect(PeerReviewModuleDef.external).toBeFalsy();
    expect(normalize(PeerReviewModuleDef)).toMatchObject({
      name: 'peer-review',
      dependsOn: ['user', 'questionnaire', 'stream'],
      aggregates: ['review-campaign'],
      useCases: ['getMyCampaigns', 'getCampaignRecipients'],
      reactions: ['createStudentCampaign'],
      jobs: [],
    });
  });

  it('ArchChecker (checkDefs) по модулю и зависимостям — без нарушений', () => {
    expect(ArchChecker.defsOf([PeerReviewModuleDef]).report()).toEqual([]);
  });
});
