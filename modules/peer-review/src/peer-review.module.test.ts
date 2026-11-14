import { describe, expect, it } from 'bun:test';
import {
  CreateReviewUcDef,
  GetCampaignRecipientsUcDef,
  GetMyCampaignsUcDef,
  GetMyReviewUcDef,
  ListMyReviewsUcDef,
  ListScopeFactsUcDef,
  ListScopeReviewsUcDef,
  ReviewAr,
  ReviewCampaignAr,
  ReviewCampaignEvents,
  ReviewEvents,
} from '@u7-scl/domain/peer-review';
import {
  GetStreamMembersUcDef,
  StreamModuleDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { type Identified, ok, UserCaller } from 'dmg-core';
import { InProcOutbox, ModuleFacades } from 'dmg-core/app';
import {
  expectOk,
  MemoryBus,
  StubFacade,
  TEST_NOW,
  TEST_TRACE,
  testAppContext,
} from 'dmg-core/testing';
import { createPeerReviewModule } from './peer-review.module';
import { CAMPAIGN_ID, T0 } from './review/review.fixture';
import { ReviewRepoFake } from './review/review.repo.fake';
import { campaign, IDS } from './review-campaign/review-campaign.fixture';
import { ReviewCampaignRepoFake } from './review-campaign/review-campaign.repo.fake';

// Вертикали на фейках репозиториев (диск проверяют контрактные тесты infra):
// кампании — student.completed → ER → кампания → UC чтения; отзывы — полный
// цикл через `dispatch` и перезапись без дубля.

const SCOPE = IDS.scope;
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const PEER = IDS.alice;
const MENTOR = '66666666-6666-4666-8666-666666666666';
const as = (uuid: string) => new UserCaller<Identified>({ uuid });

function makeModule() {
  const ctx = testAppContext();
  // Шина `testAppContext` только записывает; ER ждёт доставки подписчикам.
  const bus = new MemoryBus(ctx.published);
  const app = { ...ctx.app, bus, outbox: new InProcOutbox(bus) };
  const campaigns = new ReviewCampaignRepoFake();
  const streams = new StubFacade(StreamModuleDef).answer(
    GetStreamMembersUcDef,
    () =>
      ok({
        mentorId: MENTOR,
        students: [
          {
            studentId: crypto.randomUUID(),
            userId: SUBJECT,
            status: 'advanced',
            neverStarted: false,
            inProgress: false,
          },
          {
            studentId: crypto.randomUUID(),
            userId: PEER,
            status: 'active',
            neverStarted: false,
            inProgress: true,
          },
        ],
      }),
  );
  const module = createPeerReviewModule({
    app,
    facades: new ModuleFacades([streams]),
    campaigns,
    reviews: new ReviewRepoFake(),
  });
  return { module, campaigns, ctx, app };
}

async function waitUntil<T>(probe: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + 1000;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('waitUntil: не дождались');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('createPeerReviewModule', () => {
  it('вертикаль: student.completed → кампания → getMyCampaigns / getCampaignRecipients', async () => {
    const { module, campaigns, ctx, app } = makeModule();
    module.subscribe();

    app.bus.publish({
      ...StudentEvents.completed.make({
        studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: SUBJECT,
        streamId: SCOPE,
        moduleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        outcome: 'advanced',
      }),
      eventId: crypto.randomUUID(),
      occurredAt: TEST_NOW,
      aggregateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      cause: { kind: 'request', requestId: 'r-1' },
      correlationId: 'c-1',
    });

    const created = await waitUntil(() =>
      campaigns.findBySubject(SCOPE, SUBJECT),
    );
    expect(created.snapshot().participants).toEqual([PEER]);
    expect(
      ctx.published.filter((e) => e.name === ReviewCampaignEvents.created.name),
    ).toHaveLength(1);

    // Выборки активных кампаний (окно и роль — контрактный тест infra) отвечают созданной кампанией.
    campaigns.findActiveBySubject = async (userId) =>
      userId === SUBJECT ? [created] : [];
    campaigns.findActiveByMentor = async (userId) =>
      userId === MENTOR ? [created] : [];
    const subject = new UserCaller<Identified>({ uuid: SUBJECT });
    const mentor = new UserCaller<Identified>({ uuid: MENTOR });
    const mine = expectOk(
      await module.dispatch(
        GetMyCampaignsUcDef.command({}),
        subject,
        TEST_TRACE,
      ),
    );
    expect(mine.map((c) => [c.myRole, c.progress])).toEqual([
      ['subject', { done: 0, total: 2 }],
    ]);
    const asMentor = expectOk(
      await module.dispatch(
        GetMyCampaignsUcDef.command({}),
        mentor,
        TEST_TRACE,
      ),
    );
    expect(asMentor.map((c) => [c.myRole, c.progress])).toEqual([
      ['mentor', { done: 0, total: 1 }],
    ]);

    const recipients = expectOk(
      await module.dispatch(
        GetCampaignRecipientsUcDef.command({ campaignId: created.uuid }),
        subject,
        TEST_TRACE,
      ),
    );
    expect(recipients.recipients.map((r) => r.userId)).toEqual([PEER, MENTOR]);
  });
});

function makeReviewModule() {
  const ctx = testAppContext({ at: T0 + 60_000 });
  const campaigns = new ReviewCampaignRepoFake().seed(
    campaign({ uuid: CAMPAIGN_ID }),
  );
  const reviews = new ReviewRepoFake();
  const module = createPeerReviewModule({
    app: ctx.app,
    facades: new ModuleFacades(),
    campaigns,
    reviews,
  });
  // Выборки по скоупу и адресату (фильтр — контрактный тест infra) отвечают записанными отзывами.
  campaigns.findActiveBySubject = async (userId) =>
    userId === IDS.alice
      ? [ReviewCampaignAr.restore(campaign({ uuid: CAMPAIGN_ID }))]
      : [];
  campaigns.findActiveByMentor = async () => [];
  reviews.findByScopes = async () =>
    reviews.saved.map((s) => ReviewAr.restore(s));
  reviews.findByRecipient = async (recipientId) =>
    reviews.saved
      .filter((s) => s.recipientId === recipientId)
      .map((s) => ReviewAr.restore(s));
  return { module, ctx };
}

describe('createPeerReviewModule: отзывы', () => {
  it('полный цикл: отзывы пишутся и читаются через dispatch', async () => {
    const { module, ctx } = makeReviewModule();
    const subject = as(IDS.alice);
    const mentor = as(IDS.mentor);
    const text = 'Держал темп до конца потока, помогал с вопросами';

    const saved = expectOk(
      await module.dispatch(
        CreateReviewUcDef.command({
          campaignId: CAMPAIGN_ID,
          recipientId: IDS.bob,
          text,
        }),
        subject,
        TEST_TRACE,
      ),
    );
    expect(saved.recipientId).toBe(IDS.bob);
    expectOk(
      await module.dispatch(
        CreateReviewUcDef.command({
          campaignId: CAMPAIGN_ID,
          recipientId: IDS.alice,
          text: 'Стабильный результат и сильный финальный проект',
        }),
        mentor,
        TEST_TRACE,
      ),
    );
    expect(
      ctx.published.filter((e) => e.name === ReviewEvents.created.name),
    ).toHaveLength(2);

    // прогресс кампании видит новые отзывы
    const cards = expectOk(
      await module.dispatch(
        GetMyCampaignsUcDef.command({}),
        subject,
        TEST_TRACE,
      ),
    );
    expect(cards[0]?.progress).toEqual({ done: 1, total: 2 });

    expect(
      expectOk(
        await module.dispatch(
          GetMyReviewUcDef.command({
            campaignId: CAMPAIGN_ID,
            recipientId: IDS.bob,
          }),
          subject,
          TEST_TRACE,
        ),
      ),
    ).toEqual({ found: true, text });

    const scope = expectOk(
      await module.dispatch(
        ListScopeReviewsUcDef.command({ scopeIds: [IDS.scope] }),
        subject,
        TEST_TRACE,
      ),
    );
    const by = new Map(scope.recipients.map((r) => [r.recipientId, r]));
    expect(by.get(IDS.bob)?.reviews[0]?.direction).toBe('student_student');
    expect(by.get(IDS.alice)?.reviews[0]?.direction).toBe('mentor_student');

    const mine = expectOk(
      await module.dispatch(
        ListMyReviewsUcDef.command({}),
        as(IDS.bob),
        TEST_TRACE,
      ),
    );
    expect(mine.reviews.map((r) => r.authorId)).toEqual([IDS.alice]);

    expect(
      expectOk(
        await module.dispatch(
          ListScopeFactsUcDef.command({ scopeId: IDS.scope }),
          subject,
          TEST_TRACE,
        ),
      ),
    ).toEqual({ hasReviews: true, reviewsCount: 2 });
  });
});
