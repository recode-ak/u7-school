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
import { ListScopeReviewsUc } from './list-scope-reviews.uc';

// Перенос `api/review/list-scope-reviews-uc.test.ts` (4): прежний `direction` → `filter.direction`;
// + ReviewFilter (direction, recipientId, campaignId).

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const caller = new UserCaller<Identified>({ uuid: IDS.carol });
const U = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const OTHER_CAMPAIGN = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'list-scope-reviews-'));
  file = join(dir, 'reviews.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const seed = (...rows: unknown[]) => Bun.write(file, JSON.stringify(rows));

function ask(input: object, repo?: ReviewRepo) {
  const { app } = testAppContext();
  return new ListScopeReviewsUc(
    {
      app,
      facades: new ModuleFacades(),
      campaigns: new ReviewCampaignJsonRepo(join(dir, 'campaigns.json')),
      reviews: repo ?? new ReviewJsonRepo(file),
    },
    PeerReviewModuleDef,
  ).handle(input, caller, REQ);
}

describe('ListScopeReviewsUc (ФР-7)', () => {
  it('пустой скоуп — пустой список групп', async () => {
    expect(expectOk(await ask({ scopeIds: [IDS.scope] }))).toEqual({
      scopeIds: [IDS.scope],
      recipients: [],
    });
  });

  it('пустой scopeIds — пустой результат', async () => {
    await seed(review());
    expect(expectOk(await ask({ scopeIds: [] }))).toEqual({
      scopeIds: [],
      recipients: [],
    });
  });

  it('filter.direction: отбирает по направлению; scopeId в снимке', async () => {
    await seed(
      review({
        uuid: U(1),
        direction: 'student_mentor',
        recipientId: IDS.mentor,
      }),
      review({
        uuid: U(2),
        scopeId: IDS.scope2,
        authorId: IDS.bob,
        direction: 'student_student',
        recipientId: IDS.alice,
      }),
    );
    const res = expectOk(
      await ask({
        scopeIds: [IDS.scope, IDS.scope2],
        filter: { direction: 'student_mentor' },
      }),
    );
    expect(res.scopeIds).toEqual([IDS.scope, IDS.scope2]);
    expect(res.recipients).toHaveLength(1);
    expect(res.recipients[0]?.reviews).toHaveLength(1);
    expect(res.recipients[0]?.reviews[0]).toMatchObject({
      scopeId: IDS.scope,
      direction: 'student_mentor',
    });
  });

  it('группировка по адресатам со снимками ролей и исходов', async () => {
    const { authorOutcome: _, ...mentorRow } = review({
      uuid: U(2),
      authorId: IDS.mentor,
      direction: 'mentor_student',
      recipientId: IDS.alice,
    });
    await seed(
      review({
        uuid: U(1),
        direction: 'student_mentor',
        recipientId: IDS.mentor,
      }),
      mentorRow,
      review({
        uuid: U(3),
        authorId: IDS.bob,
        authorOutcome: 'dropped',
        direction: 'student_student',
        recipientId: IDS.alice,
      }),
    );
    const res = expectOk(await ask({ scopeIds: [IDS.scope] }));
    expect(res.recipients).toHaveLength(2);
    const by = new Map(res.recipients.map((g) => [g.recipientId, g]));
    const aboutAlice = by.get(IDS.alice)!;
    expect(aboutAlice.reviews).toHaveLength(2);
    expect(aboutAlice.reviews[0]).toMatchObject({
      reviewId: U(2),
      authorId: IDS.mentor,
      direction: 'mentor_student',
    });
    expect(aboutAlice.reviews[0]).not.toHaveProperty('authorOutcome');
    expect(by.get(IDS.mentor)?.reviews[0]).toMatchObject({
      authorId: IDS.alice,
      direction: 'student_mentor',
      authorOutcome: 'completed_passed',
    });
  });

  it('отзывы в группе — по createdAt (число), группы — по первому появлению', async () => {
    await seed(
      review({
        uuid: U(2),
        authorId: IDS.bob,
        recipientId: IDS.alice,
        createdAt: T0 + 2 * HOUR,
      }),
      review({
        uuid: U(1),
        authorId: IDS.mentor,
        recipientId: IDS.alice,
        createdAt: T0,
      }),
    );
    const res = expectOk(await ask({ scopeIds: [IDS.scope] }));
    expect(res.recipients[0]?.reviews.map((r) => r.createdAt)).toEqual([
      T0,
      T0 + 2 * HOUR,
    ]);
  });
});

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

  it('recipientId', async () => {
    await seed(...rows());
    const res = expectOk(
      await ask({ scopeIds: [IDS.scope], filter: { recipientId: IDS.bob } }),
    );
    expect(ids(res)).toEqual([U(2), U(3)]);
    expect(res.recipients.map((g) => g.recipientId)).toEqual([IDS.bob]);
  });

  it('campaignId', async () => {
    await seed(...rows());
    const res = expectOk(
      await ask({
        scopeIds: [IDS.scope],
        filter: { campaignId: OTHER_CAMPAIGN },
      }),
    );
    expect(ids(res)).toEqual([U(2)]);
  });

  it('несколько условий — по И', async () => {
    await seed(...rows());
    const res = expectOk(
      await ask({
        scopeIds: [IDS.scope],
        filter: { direction: 'student_student', campaignId: OTHER_CAMPAIGN },
      }),
    );
    expect(ids(res)).toEqual([U(2)]);
  });

  it('фильтр без совпадений — пустые группы, scopeIds сохранены', async () => {
    await seed(...rows());
    expect(
      expectOk(
        await ask({
          scopeIds: [IDS.scope],
          filter: { recipientId: IDS.carol },
        }),
      ),
    ).toEqual({ scopeIds: [IDS.scope], recipients: [] });
  });

  it('UC передаёт фильтр репозиторию и сам в памяти не фильтрует', async () => {
    const ars = rows().map((r) => ReviewAr.restore(r));
    const findByScopes = mock(async () => ars);
    const filter = { direction: 'mentor_student' as const };

    const res = expectOk(
      await ask({ scopeIds: [IDS.scope], filter }, {
        findByScopes,
      } as unknown as ReviewRepo),
    );

    expect(findByScopes).toHaveBeenCalledWith([IDS.scope], filter);
    expect(ids(res)).toEqual([U(1), U(2), U(3)]);
  });
});
