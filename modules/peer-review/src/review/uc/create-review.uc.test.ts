import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PeerReviewModuleDef, ReviewEvents } from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewJsonRepo } from '../../infra/review.json-repo';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import { campaign } from '../../review-campaign/review-campaign.fixture';
import {
  CAMPAIGN_ID,
  DAY,
  HOUR,
  IDS,
  review,
  T0,
  TEXT,
} from '../review.fixture';
import { CreateReviewUc } from './create-review.uc';

// Перенос `api/review/create-review-uc.test.ts` (16 сценариев) на UC по Def.
// authorId — из субъекта; отказы — Result; порядок: право → окно → адресат → текст.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const as = (uuid: string) => new UserCaller<Identified>({ uuid });
/** Не кратно минуте: проверяет, что createdAt не усекается. */
const AT = T0 + 90_000;
const EXPIRES = T0 + 7 * DAY;

let dir: string;
let campaigns: ReviewCampaignJsonRepo;
let reviews: ReviewJsonRepo;
let reviewsFile: string;
let ctx: ReturnType<typeof testAppContext>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'create-review-'));
  campaigns = new ReviewCampaignJsonRepo(join(dir, 'campaigns.json'));
  reviewsFile = join(dir, 'reviews.json');
  reviews = new ReviewJsonRepo(reviewsFile);
  await Bun.write(
    join(dir, 'campaigns.json'),
    JSON.stringify([campaign({ uuid: CAMPAIGN_ID })]),
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeUc(at = AT) {
  ctx = testAppContext({ at });
  return new CreateReviewUc(
    { app: ctx.app, facades: new ModuleFacades(), campaigns, reviews },
    PeerReviewModuleDef,
  );
}

const write = (
  authorId: string,
  recipientId: string,
  text = TEXT,
  at = AT,
  campaignId = CAMPAIGN_ID,
) => makeUc(at).handle({ campaignId, recipientId, text }, as(authorId), REQ);

const stored = async () =>
  (await Bun.file(reviewsFile).exists())
    ? await Bun.file(reviewsFile).json()
    : [];

const created = () =>
  ctx.published.filter((e) => e.name === ReviewEvents.created.name);

describe('CreateReviewUc — первая запись', () => {
  it('субъект пишет ментору: снимки из кампании, отзыв сохранён', async () => {
    const res = expectOk(await write(IDS.alice, IDS.mentor));

    expect(res).toMatchObject({
      campaignId: CAMPAIGN_ID,
      recipientId: IDS.mentor,
    });
    const [saved, ...rest] = await stored();
    expect(rest).toEqual([]);
    expect(saved).toMatchObject({
      uuid: res.reviewId,
      scopeId: IDS.scope,
      campaignId: CAMPAIGN_ID,
      authorId: IDS.alice,
      direction: 'student_mentor',
      authorOutcome: 'completed_passed',
      recipientId: IDS.mentor,
      text: TEXT,
      createdAt: AT,
      updatedAt: AT,
      version: 0,
    });
  });
});

describe('CreateReviewUc — перезапись пары', () => {
  const existing = review({
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000000',
    createdAt: T0 + HOUR,
  });
  beforeEach(async () => {
    await Bun.write(reviewsFile, JSON.stringify([existing]));
  });

  it('меняются только text и updatedAt; uuid, createdAt, направление, исход сохраняются; version растёт', async () => {
    const res = expectOk(await write(IDS.alice, IDS.mentor));

    expect(res.reviewId).toBe(existing.uuid);
    const all = await stored();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      uuid: existing.uuid,
      createdAt: existing.createdAt,
      updatedAt: AT,
      text: TEXT,
      direction: 'student_mentor',
      authorOutcome: 'completed_passed',
      version: 1,
    });
  });

  it('события нет (без повторного уведомления)', async () => {
    expectOk(await write(IDS.alice, IDS.mentor));
    expect(created()).toEqual([]);
  });
});

describe('CreateReviewUc — порядок правил: окно → адресат → текст', () => {
  it('окно закрыто и адресат недопустим — WINDOW_CLOSED', async () => {
    expectErr(
      await write(IDS.alice, IDS.carol, TEXT, EXPIRES),
      'REVIEW_WINDOW_CLOSED',
    );
  });
});

describe('CreateReviewUc — кампания', () => {
  it('кампания не найдена — REVIEW_CAMPAIGN_NOT_FOUND (not_found)', async () => {
    const missing = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const error = expectErr(
      await write(IDS.alice, IDS.mentor, TEXT, AT, missing),
      'REVIEW_CAMPAIGN_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ campaignId: missing });
  });
});
