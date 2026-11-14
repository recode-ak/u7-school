import { beforeEach, describe, expect, it } from 'bun:test';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignRepoFake } from '../../review-campaign/review-campaign.repo.fake';
import { CAMPAIGN_ID, IDS, review, TEXT } from '../review.fixture';
import { ReviewRepoFake } from '../review.repo.fake';
import { GetMyReviewUc } from './get-my-review.uc';

// Автор — субъект вызова.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let reviews: ReviewRepoFake;
beforeEach(() => {
  reviews = new ReviewRepoFake();
});

function makeUc() {
  const { app } = testAppContext();
  return new GetMyReviewUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignRepoFake(),
      reviews,
    },
    PeerReviewModuleDef,
  );
}

const ask = (
  userId: string,
  campaignId = CAMPAIGN_ID,
  recipientId = IDS.mentor,
) => makeUc().handle({ campaignId, recipientId }, as(userId), REQ);

describe('GetMyReviewUc (S04 — текст моего отзыва)', () => {
  it('отзыв есть — found: true и текст', async () => {
    reviews.seed(review({ text: TEXT }));
    expect(expectOk(await ask(IDS.alice))).toEqual({ found: true, text: TEXT });
  });

  it('отзыва нет — found: false', async () => {
    expect(expectOk(await ask(IDS.alice))).toEqual({ found: false });
  });

  it('другой адресат или другая кампания — found: false', async () => {
    reviews.seed(review({ text: TEXT }));
    expect(expectOk(await ask(IDS.alice, CAMPAIGN_ID, IDS.bob))).toEqual({
      found: false,
    });
    expect(
      expectOk(await ask(IDS.alice, '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
    ).toEqual({ found: false });
  });
});
