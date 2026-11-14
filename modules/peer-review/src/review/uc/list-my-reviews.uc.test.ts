import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  PeerReviewModuleDef,
  ReviewAr,
  type ReviewState,
} from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { expectOk, TEST_TRACE, testAppContext } from 'dmg-core/testing';
import { ReviewCampaignRepoFake } from '../../review-campaign/review-campaign.repo.fake';
import { HOUR, IDS, review, T0 } from '../review.fixture';
import { ReviewRepoFake } from '../review.repo.fake';
import { ListMyReviewsUc } from './list-my-reviews.uc';

// Адресат — субъект вызова (userId во входе нет).

const as = (uuid: string) => new UserCaller<Identified>({ uuid });
const ME = IDS.alice;
const U = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const OTHER_CAMPAIGN = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let reviews: ReviewRepoFake;
beforeEach(() => {
  reviews = new ReviewRepoFake();
});

/** Ответ выборки отзывов адресату. */
const answer = (...rows: ReviewState[]) => {
  reviews.findByRecipient = async () => rows.map((r) => ReviewAr.restore(r));
};

function makeUc() {
  const { app } = testAppContext();
  return new ListMyReviewsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignRepoFake(),
      reviews,
    },
    PeerReviewModuleDef,
  );
}

const list = (input: object = {}) => makeUc().handle(input, as(ME), TEST_TRACE);

/** Отзыв мне от автора. */
const toMe = (uuid: string, over: Parameters<typeof review>[0] = {}) =>
  review({
    uuid,
    authorId: IDS.bob,
    recipientId: ME,
    direction: 'student_student',
    ...over,
  });

describe('ListMyReviewsUc (S08)', () => {
  it('новые наверху: createdAt desc, createdAt — число', async () => {
    answer(
      toMe(U(1), { createdAt: T0 }),
      toMe(U(3), { createdAt: T0 + 2 * HOUR }),
      toMe(U(2), { createdAt: T0 + HOUR }),
    );
    const res = expectOk(await list());
    expect(res.reviews.map((r) => r.reviewId)).toEqual([U(3), U(2), U(1)]);
    expect(res.reviews[0]?.createdAt).toBe(T0 + 2 * HOUR);
    expect(res.reviews[0]).toMatchObject({
      authorId: IDS.bob,
      scopeId: IDS.scope,
      direction: 'student_student',
    });
  });

  it('равные createdAt — стабильный порядок по uuid desc', async () => {
    answer(toMe(U(1)), toMe(U(9)));
    const res = expectOk(await list());
    expect(res.reviews.map((r) => r.reviewId)).toEqual([U(9), U(1)]);
  });

  it('исход автора-ментора не подмешивается; исход студента сохраняется', async () => {
    const { authorOutcome: _, ...mentorRow } = toMe(U(1), {
      direction: 'mentor_student',
      authorId: IDS.mentor,
      createdAt: T0,
    });
    answer(
      mentorRow,
      toMe(U(2), { authorOutcome: 'dropped', createdAt: T0 + HOUR }),
    );
    const res = expectOk(await list());
    expect(res.reviews[0]?.authorOutcome).toBe('dropped');
    expect(res.reviews[1]).not.toHaveProperty('authorOutcome');
  });
});

describe('ListMyReviewsUc — ReviewFilter', () => {
  const rows = () => [
    toMe(U(1), { direction: 'student_student' }),
    toMe(U(2), {
      direction: 'mentor_student',
      authorId: IDS.mentor,
      campaignId: OTHER_CAMPAIGN,
    }),
    toMe(U(3), { direction: 'student_student', campaignId: OTHER_CAMPAIGN }),
  ];

  it('UC передаёт фильтр репозиторию и сам в памяти не фильтрует', async () => {
    const ars = rows().map((r) => ReviewAr.restore(r));
    const findByRecipient = mock(async () => ars);
    reviews.findByRecipient = findByRecipient;
    const filter = { direction: 'mentor_student' as const };

    const res = expectOk(await list({ filter }));

    expect(findByRecipient).toHaveBeenCalledWith(ME, filter);
    expect(res.reviews).toHaveLength(3);
  });
});
