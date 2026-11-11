import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerReviewModuleDef, ReviewAr } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewJsonRepo } from '../../infra/review.json-repo';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import { HOUR, IDS, review, T0 } from '../review.fixture';
import type { ReviewRepo } from '../review.repo';
import { ListMyReviewsUc } from './list-my-reviews.uc';

// Перенос `api/review/list-my-reviews-uc.test.ts` (5) + фильтр ReviewFilter.
// Адресат — субъект вызова (userId во входе нет).

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });
const ME = IDS.alice;
const U = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const OTHER_CAMPAIGN = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'list-my-reviews-'));
  file = join(dir, 'reviews.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const seed = (...rows: unknown[]) => Bun.write(file, JSON.stringify(rows));

function makeUc(repo: ReviewRepo = new ReviewJsonRepo(file)) {
  const { app } = testAppContext();
  return new ListMyReviewsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(join(dir, 'campaigns.json')),
      reviews: repo,
    },
    PeerReviewModuleDef,
  );
}

const list = (input: object = {}, repo?: ReviewRepo) =>
  makeUc(repo).handle(input, as(ME), REQ);

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
  it('только отзывы мне: чужие адресаты не попадают', async () => {
    await seed(toMe(U(1)), review({ uuid: U(2), recipientId: IDS.bob }));
    const res = expectOk(await list());
    expect(res.reviews.map((r) => r.reviewId)).toEqual([U(1)]);
    expect(res.reviews[0]).toMatchObject({
      authorId: IDS.bob,
      scopeId: IDS.scope,
      direction: 'student_student',
    });
  });

  it('новые наверху: createdAt desc, createdAt — число', async () => {
    await seed(
      toMe(U(1), { createdAt: T0 }),
      toMe(U(3), { createdAt: T0 + 2 * HOUR }),
      toMe(U(2), { createdAt: T0 + HOUR }),
    );
    const res = expectOk(await list());
    expect(res.reviews.map((r) => r.reviewId)).toEqual([U(3), U(2), U(1)]);
    expect(res.reviews[0]?.createdAt).toBe(T0 + 2 * HOUR);
  });

  it('равные createdAt — стабильный порядок по uuid desc', async () => {
    await seed(toMe(U(1)), toMe(U(9)));
    const res = expectOk(await list());
    expect(res.reviews.map((r) => r.reviewId)).toEqual([U(9), U(1)]);
  });

  it('исход автора-ментора не подмешивается; исход студента сохраняется', async () => {
    const { authorOutcome: _, ...mentorRow } = toMe(U(1), {
      direction: 'mentor_student',
      authorId: IDS.mentor,
      createdAt: T0,
    });
    await seed(
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
    const filter = { direction: 'mentor_student' as const };

    const res = expectOk(
      await list({ filter }, { findByRecipient } as unknown as ReviewRepo),
    );

    expect(findByRecipient).toHaveBeenCalledWith(ME, filter);
    expect(res.reviews).toHaveLength(3);
  });
});
