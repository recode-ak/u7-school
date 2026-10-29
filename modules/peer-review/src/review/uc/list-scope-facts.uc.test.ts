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
import { IDS, review } from '../review.fixture';
import { ListScopeFactsUc } from './list-scope-facts.uc';

// Перенос `api/review/list-scope-facts-uc.test.ts`.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new UserCaller<Identified>({ uuid: IDS.alice });

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'list-scope-facts-'));
  file = join(dir, 'reviews.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function ask(scopeId = IDS.scope) {
  const { app } = testAppContext();
  return new ListScopeFactsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(join(dir, 'campaigns.json')),
      reviews: new ReviewJsonRepo(file),
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
    await Bun.write(file, JSON.stringify([review(), review()]));
    expect(expectOk(await ask())).toEqual({
      hasReviews: true,
      reviewsCount: 2,
    });
  });

  it('считаются только отзывы этого скоупа', async () => {
    await Bun.write(
      file,
      JSON.stringify([review(), review({ scopeId: IDS.scope2 })]),
    );
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
