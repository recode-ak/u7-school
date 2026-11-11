import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PeerReviewModuleDef,
  ReviewCampaignEvents,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import {
  GetStreamMembersUcDef,
  StreamModuleDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { CoreErrors, ok } from 'dmg-core';
import { type EnvelopeOf, ModuleFacades } from 'dmg-core/app';
import {
  expectErr,
  expectIdempotentReaction,
  expectOk,
  MemoryBus,
  StubFacade,
  TEST_NOW,
  testAppContext,
} from 'dmg-core/testing';
import { ReviewCampaignJsonRepo } from '../../infra/review-campaign.json-repo';
import { FactsReviewRepo } from '../../review/review.fixture';
import { campaign, DAY } from '../review-campaign.fixture';
import { CreateStudentCampaignEr } from './create-student-campaign.er';

// Перенос legacy `api/er/create-student-campaign-er.test.ts` на ER по Def.
// Состав потока — StubFacade над GetStreamMembersUcDef (ARC-06).

const SCOPE = '11111111-1111-4111-8111-111111111111';
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const MENTOR = '66666666-6666-4666-8666-666666666666';
const LIVE = '22222222-2222-4222-8222-222222222222';
const DONE = '33333333-3333-4333-8333-333333333333';
const DROP = '44444444-4444-4444-8444-444444444444';
const NEVER = '88888888-8888-4888-8888-888888888888';
const STUDENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type Status = 'enrolled' | 'active' | 'abandoned' | 'advanced' | 'not_advanced';
const member = (userId: string, status: Status, neverStarted = false) => ({
  studentId: crypto.randomUUID(),
  userId,
  status,
  neverStarted,
  inProgress: status === 'active' || status === 'enrolled',
});
const fullMembers = (subject = member(SUBJECT, 'advanced')) => ({
  mentorId: MENTOR,
  students: [
    subject,
    member(LIVE, 'active'),
    member(DONE, 'not_advanced'),
    member(DROP, 'abandoned'),
    member(NEVER, 'abandoned', true),
  ],
});

let dir: string;
let file: string;
let campaigns: ReviewCampaignJsonRepo;
let streams: StubFacade<typeof StreamModuleDef>;
let ctx: ReturnType<typeof testAppContext>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'create-student-campaign-'));
  file = join(dir, 'campaigns.json');
  campaigns = new ReviewCampaignJsonRepo(file);
  streams = new StubFacade(StreamModuleDef).answer(GetStreamMembersUcDef, () =>
    ok(fullMembers()),
  );
  ctx = testAppContext();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const makeEr = () =>
  new CreateStudentCampaignEr(
    {
      app: ctx.app,
      facades: new ModuleFacades([streams]),
      campaigns,
      reviews: new FactsReviewRepo(),
    },
    PeerReviewModuleDef,
  );

const envelope = {
  eventId: '',
  occurredAt: TEST_NOW,
  aggregateId: STUDENT,
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
} as const;

function completed(
  outcome: 'advanced' | 'not_advanced' = 'advanced',
): EnvelopeOf<typeof StudentEvents.completed> {
  return {
    ...StudentEvents.completed.make({
      studentId: STUDENT,
      userId: SUBJECT,
      streamId: SCOPE,
      moduleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      outcome,
    }),
    ...envelope,
    eventId: crypto.randomUUID(),
  };
}

function abandoned(
  userId: string = SUBJECT,
  studentId: string = STUDENT,
): EnvelopeOf<typeof StudentEvents.abandoned> {
  return {
    ...StudentEvents.abandoned.make({
      studentId,
      userId,
      streamId: SCOPE,
      who: 'self',
      cause: 'voluntary',
    }),
    ...envelope,
    aggregateId: studentId,
    eventId: crypto.randomUUID(),
  };
}

async function stored(): Promise<ReviewCampaignState[]> {
  return (await Bun.file(file).exists()) ? await Bun.file(file).json() : [];
}

// Второй субъект для проверки подписки на второе событие (ключ кампании — субъект).
const SUBJECT2 = '77777777-7777-4777-8777-777777777778';
const STUDENT2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';

describe('CreateStudentCampaignEr — создание кампании', () => {
  it('student.completed → кампания stream_fate с ключом (scopeId, subjectId), окно 7 суток от часов', async () => {
    expectOk(await makeEr().handle(completed()));

    const [saved, ...rest] = await stored();
    expect(rest).toEqual([]);
    expect(saved).toMatchObject({
      context: 'stream_fate',
      scopeId: SCOPE,
      subjectId: SUBJECT,
      createdAt: TEST_NOW,
      expiresAt: TEST_NOW + 7 * DAY,
      version: 0,
    });
  });

  it('«забросил»: пустой participants, исход dropped', async () => {
    expectOk(await makeEr().handle(abandoned()));
    const [saved] = await stored();
    expect(saved?.participants).toEqual([]);
    expect(saved?.payload.subjectOutcome).toBe('dropped');
  });

  it('abandoned, субъект никогда не начинал → never_started', async () => {
    streams.answer(GetStreamMembersUcDef, () =>
      ok(fullMembers(member(SUBJECT, 'abandoned', true))),
    );
    expectOk(await makeEr().handle(abandoned()));
    const [saved] = await stored();
    expect(saved?.participants).toEqual([]);
    expect(saved?.payload.subjectOutcome).toBe('never_started');
  });

  it('состав потока спрашивается у модуля stream по streamId события', async () => {
    expectOk(await makeEr().handle(completed()));
    expect(streams.received.map((c) => [c.def, c.input])).toEqual([
      [GetStreamMembersUcDef, { streamId: SCOPE }],
    ]);
  });

  it('публикует peer-review.review-campaign.created после сохранения, с данными для UI (ФР-5)', async () => {
    expectOk(await makeEr().handle(completed()));

    const [saved] = await stored();
    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]).toMatchObject({
      name: ReviewCampaignEvents.created.name,
      aggregateId: saved?.uuid,
      payload: {
        campaignId: saved?.uuid,
        context: 'stream_fate',
        scopeId: SCOPE,
        subjectId: SUBJECT,
        mentorId: MENTOR,
        subjectOutcome: 'completed_passed',
      },
    });
  });
});

describe('CreateStudentCampaignEr — идемпотентность и деградация', () => {
  it('кампания окна уже есть — Ok без записи и без события (unique трактуется как успех)', async () => {
    await Bun.write(
      file,
      JSON.stringify([
        campaign({
          scopeId: SCOPE,
          subjectId: SUBJECT,
          participants: [],
          payload: { subjectOutcome: 'dropped', mentorId: MENTOR },
        }),
      ]),
    );
    const before = await Bun.file(file).text();

    expectOk(await makeEr().handle(completed()));
    expectOk(await makeEr().handle(abandoned()));

    expect(await Bun.file(file).text()).toBe(before);
    expect(ctx.published).toEqual([]);
  });

  it('повтор с новым eventId — без записей и событий (D-47)', async () => {
    const er = makeEr();
    await expectIdempotentReaction({
      event: completed(),
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => stored(),
    });
  });

  it('состав потока недоступен — Ok, warn «Состав потока недоступен — кампания не создана», кампании нет', async () => {
    streams.answer(GetStreamMembersUcDef, () => ok(undefined));

    expectOk(await makeEr().handle(completed()));

    expect(await Bun.file(file).exists()).toBe(false);
    expect(ctx.published).toEqual([]);
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining(
          'Состав потока недоступен — кампания не создана',
        ),
      }),
    );
  });

  it('отказ UC состава потока — отказ реакции, ничего не записано', async () => {
    streams.answer(GetStreamMembersUcDef, () =>
      CoreErrors.SERVER_INTERNAL.err(),
    );

    expectErr(await makeEr().handle(completed()), 'SERVER_INTERNAL');

    expect(await Bun.file(file).exists()).toBe(false);
    expect(ctx.published).toEqual([]);
  });
});

describe('CreateStudentCampaignEr.subscribe', () => {
  it('реагирует на student.completed и student.abandoned из шины', async () => {
    const bus = new MemoryBus();
    const er = makeEr();
    const pending: Promise<unknown>[] = [];
    const handle = er.handle.bind(er);
    er.handle = (...args) => {
      const done = handle(...args);
      pending.push(done);
      return done;
    };
    er.subscribe(bus);

    bus.publish(completed());
    await Promise.all(pending);
    pending.length = 0;

    bus.publish(abandoned(SUBJECT2, STUDENT2));
    await Promise.all(pending);

    expect((await stored()).map((c) => c.subjectId).sort()).toEqual(
      [SUBJECT, SUBJECT2].sort(),
    );
  });
});
