import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import {
  FactsReviewRepo,
  type ReviewFactStub,
} from '../../review/review.fixture';
import { campaign, IDS, T0 } from '../review-campaign.fixture';
import { GetMyCampaignsUc } from './get-my-campaigns.uc';

// Перенос legacy `api/review-campaign/get-my-campaigns-uc.test.ts` на UC по Def.
// Пользователь — из субъекта вызова (без userId во входе); часы — часы приложения.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'get-my-campaigns-'));
  file = join(dir, 'campaigns.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function seed(...rows: unknown[]) {
  await Bun.write(file, JSON.stringify(rows));
}

function makeUc(reviews: ReviewFactStub[] = [], at = T0) {
  const { app } = testAppContext({ at });
  return new GetMyCampaignsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(file),
      reviews: new FactsReviewRepo(reviews),
    },
    PeerReviewModuleDef,
  );
}

describe('GetMyCampaignsUc (ФР-7)', () => {
  it('различает myRole: субъект', async () => {
    const own = campaign();
    await seed(own);

    const cards = expectOk(await makeUc().handle({}, as(IDS.alice), REQ));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      campaignId: own.uuid,
      myRole: 'subject',
      subjectId: IDS.alice,
      context: 'stream_fate',
      scopeId: IDS.scope,
      subjectOutcome: 'completed_passed',
      expiresAt: own.expiresAt,
      daysLeft: 7,
    });
  });

  it('прогресс M/K: мои отзывы / адресаты политики', async () => {
    const own = campaign();
    await seed(own);
    const reviews = [
      { authorId: IDS.alice, recipientId: IDS.mentor },
      { authorId: IDS.alice, recipientId: IDS.bob },
      { authorId: IDS.mentor, recipientId: IDS.alice },
    ];

    const [card] = expectOk(
      await makeUc(reviews).handle({}, as(IDS.alice), REQ),
    );

    // K — соученик + ментор; M — два отзыва от alice из трёх
    expect(card?.progress).toEqual({ done: 2, total: 2 });
  });

  it('filter: по scopeId и по context', async () => {
    const inScope = campaign();
    const otherScope = campaign({ scopeId: IDS.scope2 });
    await seed(inScope, otherScope);

    const byScope = expectOk(
      await makeUc().handle(
        { filter: { scopeId: IDS.scope2 } },
        as(IDS.alice),
        REQ,
      ),
    );
    expect(byScope.map((c) => c.scopeId)).toEqual([IDS.scope2]);

    const byContext = expectOk(
      await makeUc().handle(
        { filter: { context: 'stream_fate' } },
        as(IDS.alice),
        REQ,
      ),
    );
    expect(byContext).toHaveLength(2);
  });

  it('субъектные и менторские кампании одного пользователя — вместе', async () => {
    const asSubject = campaign();
    const asMentor = campaign({
      scopeId: IDS.scope2,
      subjectId: IDS.bob,
      participants: [],
      payload: { subjectOutcome: 'dropped', mentorId: IDS.alice },
    });
    await seed(asSubject, asMentor);

    const cards = expectOk(await makeUc().handle({}, as(IDS.alice), REQ));

    expect(cards.map((c) => [c.campaignId, c.myRole])).toEqual([
      [asSubject.uuid, 'subject'],
      [asMentor.uuid, 'mentor'],
    ]);
  });

  it('граница окна: ровно в expiresAt кампания уже не активна', async () => {
    const own = campaign();
    await seed(own);

    const before = await makeUc([], own.expiresAt - 1).handle(
      {},
      as(IDS.alice),
      REQ,
    );
    const at = await makeUc([], own.expiresAt).handle({}, as(IDS.alice), REQ);

    expect(expectOk(before)).toHaveLength(1);
    expect(expectOk(at)).toEqual([]);
  });
});
