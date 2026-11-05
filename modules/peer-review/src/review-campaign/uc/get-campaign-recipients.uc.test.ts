import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import {
  FactsReviewRepo,
  type ReviewFactStub,
} from '../../review/review.fixture';
import { campaign, DAY, IDS, T0 } from '../review-campaign.fixture';
import { GetCampaignRecipientsUc } from './get-campaign-recipients.uc';

// Перенос legacy `api/review-campaign/get-campaign-recipients-uc.test.ts`.
// authorId берётся из субъекта; посторонний — отказ Policy isWindowAuthor (ACCESS_DENIED).

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'get-campaign-recipients-'));
  file = join(dir, 'campaigns.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeUc(reviews: ReviewFactStub[] = [], at = T0) {
  const { app } = testAppContext({ at });
  return new GetCampaignRecipientsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(file),
      reviews: new FactsReviewRepo(reviews),
    },
    PeerReviewModuleDef,
  );
}

const seed = (...rows: unknown[]) => Bun.write(file, JSON.stringify(rows));

describe('GetCampaignRecipientsUc', () => {
  it('субъект: соученик + ментор, признак hasMyReview', async () => {
    const c = campaign();
    await seed(c);

    const res = expectOk(
      await makeUc([{ authorId: IDS.alice, recipientId: IDS.mentor }]).handle(
        { campaignId: c.uuid },
        as(IDS.alice),
        REQ,
      ),
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
    await seed(c);

    const res = expectOk(
      await makeUc([], c.expiresAt + DAY).handle(
        { campaignId: c.uuid },
        as(IDS.alice),
        REQ,
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
      await seed(c);

      const res = await makeUc().handle(
        { campaignId: c.uuid },
        as(userId),
        REQ,
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
      REQ,
    );

    const error = expectErr(res, 'REVIEW_CAMPAIGN_NOT_FOUND');
    expect(error.payload).toEqual({ campaignId: missing });
  });
});
