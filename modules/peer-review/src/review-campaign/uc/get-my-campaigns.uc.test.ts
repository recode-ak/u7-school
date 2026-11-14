import { beforeEach, describe, expect, it } from 'bun:test';
import {
  PeerReviewModuleDef,
  ReviewCampaignAr,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { factReviews } from '../../review/review.fixture';
import { ReviewRepoFake } from '../../review/review.repo.fake';
import { campaign, IDS, T0 } from '../review-campaign.fixture';
import { ReviewCampaignRepoFake } from '../review-campaign.repo.fake';
import { GetMyCampaignsUc } from './get-my-campaigns.uc';

// Пользователь — из субъекта вызова (без userId во входе); часы — часы приложения.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

let campaigns: ReviewCampaignRepoFake;
let reviews: ReviewRepoFake;
beforeEach(() => {
  campaigns = new ReviewCampaignRepoFake();
  reviews = new ReviewRepoFake();
});

/** Ответ выборок активных кампаний: где пользователь — субъект и где — ментор. */
function answer(
  asSubject: ReviewCampaignState[],
  asMentor: ReviewCampaignState[] = [],
) {
  campaigns.findActiveBySubject = async () =>
    asSubject.map((s) => ReviewCampaignAr.restore(s));
  campaigns.findActiveByMentor = async () =>
    asMentor.map((s) => ReviewCampaignAr.restore(s));
}

function makeUc(at = T0) {
  const { app } = testAppContext({ at });
  return new GetMyCampaignsUc(
    { app, facades: new ModuleFacades(), campaigns, reviews },
    PeerReviewModuleDef,
  );
}

describe('GetMyCampaignsUc (ФР-7)', () => {
  it('различает myRole: субъект', async () => {
    const own = campaign();
    answer([own]);

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
    answer([own]);
    reviews.seed(
      ...factReviews(
        [
          { authorId: IDS.alice, recipientId: IDS.mentor },
          { authorId: IDS.alice, recipientId: IDS.bob },
          { authorId: IDS.mentor, recipientId: IDS.alice },
        ],
        own.uuid,
      ),
    );

    const [card] = expectOk(await makeUc().handle({}, as(IDS.alice), REQ));

    // K — соученик + ментор; M — два отзыва от alice из трёх
    expect(card?.progress).toEqual({ done: 2, total: 2 });
  });

  it('filter: по scopeId и по context', async () => {
    const inScope = campaign();
    const otherScope = campaign({ scopeId: IDS.scope2 });
    answer([inScope, otherScope]);

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
    answer([asSubject], [asMentor]);

    const cards = expectOk(await makeUc().handle({}, as(IDS.alice), REQ));

    expect(cards.map((c) => [c.campaignId, c.myRole])).toEqual([
      [asSubject.uuid, 'subject'],
      [asMentor.uuid, 'mentor'],
    ]);
  });
});
