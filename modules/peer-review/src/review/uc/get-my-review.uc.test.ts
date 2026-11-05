import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewJsonRepo } from '../../infra/review.json-repo';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import { CAMPAIGN_ID, IDS, review, TEXT } from '../review.fixture';
import { GetMyReviewUc } from './get-my-review.uc';

// Перенос `api/review/get-my-review-uc.test.ts`: автор — субъект вызова.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'get-my-review-'));
  file = join(dir, 'reviews.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeUc() {
  const { app } = testAppContext();
  return new GetMyReviewUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(join(dir, 'campaigns.json')),
      reviews: new ReviewJsonRepo(file),
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
    await Bun.write(file, JSON.stringify([review({ text: TEXT })]));
    expect(expectOk(await ask(IDS.alice))).toEqual({ found: true, text: TEXT });
  });

  it('отзыва нет — found: false', async () => {
    expect(expectOk(await ask(IDS.alice))).toEqual({ found: false });
  });

  it('другой адресат или другая кампания — found: false', async () => {
    await Bun.write(file, JSON.stringify([review({ text: TEXT })]));
    expect(expectOk(await ask(IDS.alice, CAMPAIGN_ID, IDS.bob))).toEqual({
      found: false,
    });
    expect(
      expectOk(await ask(IDS.alice, '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
    ).toEqual({ found: false });
  });
});
