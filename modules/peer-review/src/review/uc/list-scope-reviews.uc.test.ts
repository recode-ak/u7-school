import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { PeerReviewModuleDef, ReviewAr } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignRepoFake } from '../../review-campaign/review-campaign.repo.fake';
import { IDS, review } from '../review.fixture';
import { ReviewRepoFake } from '../review.repo.fake';
import { ListScopeReviewsUc } from './list-scope-reviews.uc';

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new UserCaller<Identified>({ uuid: IDS.carol });
const U = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const OTHER_CAMPAIGN = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let reviews: ReviewRepoFake;
beforeEach(() => {
  reviews = new ReviewRepoFake();
});

function ask(input: object) {
  const { app } = testAppContext();
  return new ListScopeReviewsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignRepoFake(),
      reviews,
    },
    PeerReviewModuleDef,
  ).handle(input, caller, REQ);
}

describe('ListScopeReviewsUc — ReviewFilter', () => {
  const rows = () => [
    review({
      uuid: U(1),
      direction: 'student_mentor',
      recipientId: IDS.mentor,
    }),
    review({
      uuid: U(2),
      direction: 'student_student',
      recipientId: IDS.bob,
      campaignId: OTHER_CAMPAIGN,
    }),
    review({
      uuid: U(3),
      direction: 'student_student',
      recipientId: IDS.bob,
    }),
  ];
  const ids = (res: { recipients: { reviews: { reviewId: string }[] }[] }) =>
    res.recipients.flatMap((g) => g.reviews.map((r) => r.reviewId)).sort();

  it('UC передаёт фильтр репозиторию и сам в памяти не фильтрует', async () => {
    const ars = rows().map((r) => ReviewAr.restore(r));
    const findByScopes = mock(async () => ars);
    reviews.findByScopes = findByScopes;
    const filter = { direction: 'mentor_student' as const };

    const res = expectOk(await ask({ scopeIds: [IDS.scope], filter }));

    expect(findByScopes).toHaveBeenCalledWith([IDS.scope], filter);
    expect(ids(res)).toEqual([U(1), U(2), U(3)]);
    expect(res.scopeIds).toEqual([IDS.scope]);
    expect(
      res.recipients.flatMap((g) => g.reviews.map((r) => r.scopeId)),
    ).toEqual([IDS.scope, IDS.scope, IDS.scope]);
  });
});
