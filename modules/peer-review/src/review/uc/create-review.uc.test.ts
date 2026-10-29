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

  it('ментор пишет субъекту: mentor_student, authorOutcome не пишется', async () => {
    expectOk(await write(IDS.mentor, IDS.alice));
    const [saved] = await stored();
    expect(saved).toMatchObject({
      authorId: IDS.mentor,
      direction: 'mentor_student',
      recipientId: IDS.alice,
    });
    expect(saved).not.toHaveProperty('authorOutcome');
  });

  it('субъект пишет соученику: student_student + снимок исхода', async () => {
    expectOk(await write(IDS.alice, IDS.bob));
    expect((await stored())[0]).toMatchObject({
      direction: 'student_student',
      authorOutcome: 'completed_passed',
    });
  });

  it('границы текста: ровно 10 и ровно 3500 символов принимаются', async () => {
    expectOk(await write(IDS.alice, IDS.bob, 'а'.repeat(10)));
    expectOk(await write(IDS.alice, IDS.mentor, 'б'.repeat(3500)));
    expect(await stored()).toHaveLength(2);
  });

  it('событие peer-review.review.created публикуется один раз с payload', async () => {
    const res = expectOk(await write(IDS.alice, IDS.bob));
    expect(created()).toHaveLength(1);
    expect(created()[0]).toMatchObject({
      name: ReviewEvents.created.name,
      aggregateId: res.reviewId,
      payload: {
        reviewId: res.reviewId,
        campaignId: CAMPAIGN_ID,
        scopeId: IDS.scope,
        authorId: IDS.alice,
        recipientId: IDS.bob,
        direction: 'student_student',
      },
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

  it('короткий текст при перезаписи — REVIEW_TEXT_INVALID, прежний текст цел', async () => {
    const error = expectErr(
      await write(IDS.alice, IDS.mentor, 'коротко'),
      'REVIEW_TEXT_INVALID',
    );
    expect(error.kind).toBe('validation');
    expect((await stored())[0].text).toBe(existing.text);
  });

  it('окно закрыто — перезапись отказана', async () => {
    expectErr(
      await write(IDS.alice, IDS.mentor, TEXT, EXPIRES),
      'REVIEW_WINDOW_CLOSED',
    );
    expect((await stored())[0].text).toBe(existing.text);
  });
});

describe('CreateReviewUc — окно', () => {
  it('истёкшее окно — REVIEW_WINDOW_CLOSED (conflict), expiresAt — число', async () => {
    const error = expectErr(
      await write(IDS.alice, IDS.mentor, TEXT, EXPIRES + DAY),
      'REVIEW_WINDOW_CLOSED',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({
      campaignId: CAMPAIGN_ID,
      expiresAt: EXPIRES,
    });
    expect(await stored()).toEqual([]);
    expect(created()).toEqual([]);
  });

  it('граница: в момент expiresAt нельзя, за 1 мс до — можно', async () => {
    expectErr(
      await write(IDS.alice, IDS.mentor, TEXT, EXPIRES),
      'REVIEW_WINDOW_CLOSED',
    );
    const res = expectOk(await write(IDS.alice, IDS.mentor, TEXT, EXPIRES - 1));
    expect(res.recipientId).toBe(IDS.mentor);
  });
});

describe('CreateReviewUc — адресат', () => {
  it.each([
    ['вне списка автора', IDS.alice, IDS.carol],
    ['о себе', IDS.alice, IDS.alice],
    ['не участник кампании', IDS.alice, IDS.stranger],
    ['ментор пишет соученику', IDS.mentor, IDS.bob],
  ])(
    '%s — REVIEW_RECIPIENT_NOT_ALLOWED (conflict) с payload',
    async (_l, author, recipient) => {
      const error = expectErr(
        await write(author, recipient),
        'REVIEW_RECIPIENT_NOT_ALLOWED',
      );
      expect(error.kind).toBe('conflict');
      expect(error.payload).toEqual({
        campaignId: CAMPAIGN_ID,
        authorId: author,
        recipientId: recipient,
      });
      expect(await stored()).toEqual([]);
    },
  );
});

describe('CreateReviewUc — текст', () => {
  it.each([
    ['короче минимума', 'коротко', 7],
    ['длиннее максимума', 'а'.repeat(3501), 3501],
  ])(
    '%s — REVIEW_TEXT_INVALID (validation) с payload',
    async (_l, text, length) => {
      const error = expectErr(
        await write(IDS.alice, IDS.mentor, text),
        'REVIEW_TEXT_INVALID',
      );
      expect(error.kind).toBe('validation');
      expect(error.payload).toEqual({ min: 10, max: 3500, length });
      expect(await stored()).toEqual([]);
      expect(created()).toEqual([]);
    },
  );
});

describe('CreateReviewUc — право (Policy раньше правил)', () => {
  it.each([
    ['соученик-автор (не субъект и не ментор)', IDS.bob],
    ['посторонний автор', IDS.stranger],
  ])(
    '%s — ACCESS_DENIED (isCampaignAuthor), записи нет',
    async (_l, author) => {
      const error = expectErr(await write(author, IDS.mentor), 'ACCESS_DENIED');
      expect(error.payload).toMatchObject({ rule: 'isCampaignAuthor' });
      expect(await stored()).toEqual([]);
      expect(created()).toEqual([]);
    },
  );

  it('посторонний при истёкшем окне — ACCESS_DENIED, а не WINDOW_CLOSED', async () => {
    const error = expectErr(
      await write(IDS.stranger, IDS.mentor, TEXT, EXPIRES + DAY),
      'ACCESS_DENIED',
    );
    expect(error.payload).toMatchObject({ rule: 'isCampaignAuthor' });
  });

  it('соученик при истёкшем окне — ACCESS_DENIED', async () => {
    expectErr(await write(IDS.bob, IDS.mentor, TEXT, EXPIRES), 'ACCESS_DENIED');
  });

  it('посторонний с коротким текстом и чужим адресатом — ACCESS_DENIED', async () => {
    expectErr(await write(IDS.stranger, IDS.carol, 'x'), 'ACCESS_DENIED');
  });
});

describe('CreateReviewUc — порядок правил: окно → адресат → текст', () => {
  it('окно закрыто и адресат недопустим — WINDOW_CLOSED', async () => {
    expectErr(
      await write(IDS.alice, IDS.carol, TEXT, EXPIRES),
      'REVIEW_WINDOW_CLOSED',
    );
  });

  it('окно закрыто и текст короткий — WINDOW_CLOSED', async () => {
    expectErr(
      await write(IDS.alice, IDS.mentor, 'x', EXPIRES),
      'REVIEW_WINDOW_CLOSED',
    );
  });

  it('адресат недопустим и текст короткий — RECIPIENT_NOT_ALLOWED', async () => {
    expectErr(
      await write(IDS.alice, IDS.carol, 'x'),
      'REVIEW_RECIPIENT_NOT_ALLOWED',
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
