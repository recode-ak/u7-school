import { beforeEach, describe, expect, it } from 'bun:test';
import {
  PeerReviewModuleDef,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  TEST_TRACE,
  testAppContext,
} from 'dmg-core/testing';
import { factReviews } from '../../review/review.fixture';
import { ReviewRepoFake } from '../../review/review.repo.fake';
import { campaign, DAY, IDS, T0 } from '../review-campaign.fixture';
import { ReviewCampaignRepoFake } from '../review-campaign.repo.fake';
import { GetCampaignRecipientsUc } from './get-campaign-recipients.uc';

// authorId берётся из субъекта; посторонний — отказ Policy isWindowAuthor (ACCESS_DENIED).

const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let campaigns: ReviewCampaignRepoFake;
let reviews: ReviewRepoFake;
beforeEach(() => {
  campaigns = new ReviewCampaignRepoFake();
  reviews = new ReviewRepoFake();
});

function makeUc(at = T0) {
  const { app } = testAppContext({ at });
  return new GetCampaignRecipientsUc(
    { app, facades: new ModuleFacades(), campaigns, reviews },
    PeerReviewModuleDef,
  );
}

const seed = (...rows: ReviewCampaignState[]) => campaigns.seed(...rows);

describe('GetCampaignRecipientsUc', () => {
  it('субъект: соученик + ментор, признак hasMyReview', async () => {
    const c = campaign();
    seed(c);
    reviews.seed(
      ...factReviews(
        [{ authorId: IDS.alice, recipientId: IDS.mentor }],
        c.uuid,
      ),
    );

    const res = expectOk(
      await makeUc().handle({ campaignId: c.uuid }, as(IDS.alice), TEST_TRACE),
    );

    expect(res).toMatchObject({
      campaignId: c.uuid,
      context: 'stream_fate',
      myRole: 'subject',
      mentorId: IDS.mentor,
      subjectOutcome: 'completed_passed',
    });
    expect(res.daysLeft).toBeGreaterThan(0);
    expect(res.recipients).toEqual([
      { userId: IDS.bob, hasMyReview: false },
      { userId: IDS.mentor, hasMyReview: true },
    ]);
  });

  it('истёкшая кампания читается, daysLeft = 0', async () => {
    const c = campaign();
    seed(c);

    const res = expectOk(
      await makeUc(c.expiresAt + DAY).handle(
        { campaignId: c.uuid },
        as(IDS.alice),
        TEST_TRACE,
      ),
    );

    expect(res.daysLeft).toBe(0);
  });

  it.each([
    ['адресуемый соученик', IDS.bob],
    ['посторонний', IDS.stranger],
  ])(
    '%s — ACCESS_DENIED (Policy isWindowAuthor), вместо PEER_REVIEW_NOT_PARTICIPANT',
    async (_l, userId) => {
      const c = campaign();
      seed(c);

      const res = await makeUc().handle(
        { campaignId: c.uuid },
        as(userId),
        TEST_TRACE,
      );

      const error = expectErr(res, 'ACCESS_DENIED');
      expect(error.payload).toMatchObject({ rule: 'isWindowAuthor' });
    },
  );

  it('кампания не найдена — REVIEW_CAMPAIGN_NOT_FOUND', async () => {
    const missing = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const res = await makeUc().handle(
      { campaignId: missing },
      as(IDS.alice),
      TEST_TRACE,
    );

    const error = expectErr(res, 'REVIEW_CAMPAIGN_NOT_FOUND');
    expect(error.payload).toEqual({ campaignId: missing });
  });
});
