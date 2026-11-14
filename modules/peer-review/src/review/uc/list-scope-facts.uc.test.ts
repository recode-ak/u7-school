import { beforeEach, describe, expect, it } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignRepoFake } from '../../review-campaign/review-campaign.repo.fake';
import { IDS, review } from '../review.fixture';
import { ReviewRepoFake } from '../review.repo.fake';
import { ListScopeFactsUc } from './list-scope-facts.uc';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new UserCaller<Identified>({ uuid: IDS.alice });

let reviews: ReviewRepoFake;
beforeEach(() => {
  reviews = new ReviewRepoFake();
});

function ask(scopeId = IDS.scope) {
  const { app } = testAppContext();
  return new ListScopeFactsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignRepoFake(),
      reviews,
    },
    PeerReviewModuleDef,
  ).handle({ scopeId }, caller, REQ);
}

describe('ListScopeFactsUc (ФР-8)', () => {
  it('отзывов нет — hasReviews false, count 0', async () => {
    expect(expectOk(await ask())).toEqual({
      hasReviews: false,
      reviewsCount: 0,
    });
  });

  it('отзывы есть — hasReviews true, count N', async () => {
    reviews.seed(review(), review());
    expect(expectOk(await ask())).toEqual({
      hasReviews: true,
      reviewsCount: 2,
    });
  });

  it('считаются только отзывы этого скоупа', async () => {
    reviews.seed(review(), review({ scopeId: IDS.scope2 }));
    expect(expectOk(await ask())).toEqual({
      hasReviews: true,
      reviewsCount: 1,
    });
    expect(expectOk(await ask(IDS.scope2))).toEqual({
      hasReviews: true,
      reviewsCount: 1,
    });
  });
});
