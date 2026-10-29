import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { User } from '@u7-scl/app-legacy';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { InProcEventBus } from '@u7-scl/core/infra';
import type { Logger } from '@u7-scl/core/shared';
import {
  GetCampaignRecipientsUcDef,
  GetMyCampaignsUcDef,
  type PeerReviewApiModuleResolver,
  ReviewCampaignAr,
} from '@u7-scl/domain/peer-review';
import { type Identified, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { ReviewJsonRepo } from '../infra/db/review-json-repo';
import { ReviewCampaignJsonRepo } from '../infra/review-campaign.json-repo';
import { createPeerReviewModule } from '../peer-review.module';
import { PeerReviewApiModule } from './module';

const SCOPE = '11111111-1111-4111-8111-111111111111';
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const PEER = '22222222-2222-4222-8222-222222222222';
const MENTOR = '66666666-6666-4666-8666-666666666666';

/** Актор-заглушка: checkAuth проверяет только наличие. */
const ACTOR = { uuid: SUBJECT } as unknown as User;

/** Тихий логгер: вертикаль не должна сорить выводом тестов. */
const SILENT_LOGGER = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
} as unknown as Logger;

/**
 * Собирает вертикаль: json-репозитории, шина in-proc, legacy-модуль рецензий
 * (create-review и чтение) и Def-модуль кампаний (`createPeerReviewModule`) над
 * теми же репозиториями. Кампанию открывает ER Def-модуля — его вертикаль в
 * `../peer-review.module.test.ts`, здесь кампания создаётся напрямую Ar.
 */
function makeVertical() {
  const eventBus = new InProcEventBus();
  // Свой каталог на каждый тест: файлы репозиториев не пересекаются.
  const own = join(dir, crypto.randomUUID());
  const campaigns = new ReviewCampaignJsonRepo(join(own, 'campaigns.json'));
  const reviews = new ReviewJsonRepo(join(own, 'reviews.json'));
  const resolve: PeerReviewApiModuleResolver = {
    reviewCampaignRepo: campaigns,
    reviewRepo: reviews,
    streamFacade: {} as PeerReviewApiModuleResolver['streamFacade'],
    // Фасад user — стаб: имена по UUID, notify — тихая заглушка
    // (ER notify-review-recipient вызовет его при create-review).
    userFacade: {
      getUserByUuid: mock((uuid: string) =>
        Promise.resolve(
          uuid === MENTOR
            ? ({ uuid, name: 'Ментор' } as unknown as User)
            : ({
                uuid,
                name: `Участник ${uuid.slice(0, 4)}`,
              } as unknown as User),
        ),
      ),
      notify: mock(() => Promise.resolve()),
    } as unknown as PeerReviewApiModuleResolver['userFacade'],
    appResolver: {
      logger: SILENT_LOGGER,
      mode: 'test' as const,
      eventBus,
      school: TEST_SCHOOL,
    },
    eventBus,
  };

  const module = new PeerReviewApiModule(resolve);
  module.init();
  const { app } = testAppContext();
  const campaignModule = createPeerReviewModule({
    app,
    facades: new ModuleFacades(),
    campaigns,
    reviews,
  });
  return { module, campaignModule, campaigns };
}

/** Кампания окна судьбы: субъект завершил поток, соученик — PEER. */
async function openCampaign(campaigns: ReviewCampaignJsonRepo) {
  const created = expectOk(
    ReviewCampaignAr.create(
      {
        uuid: crypto.randomUUID(),
        scopeId: SCOPE,
        subjectId: SUBJECT,
        mentorId: MENTOR,
        subjectOutcome: 'completed_passed',
        participantIds: [PEER],
      },
      // окно открыто сейчас: мост create-review сверяет его с реальными часами
      Date.now(),
    ),
  );
  await campaigns.save(created);
  return created;
}

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'u7-peer-review-vertical-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const REQ = Trace.fromRequest({ requestId: 'r-1' });

describe('Вертикаль peer-review: кампания → отзыв → чтение', () => {
  test('полный цикл: отзывы пишутся через мост и читаются', async () => {
    const { module, campaignModule, campaigns } = makeVertical();
    const campaign = await openCampaign(campaigns);

    // ── Субъект пишет отзыв соученику в окне ──
    const saved = await module.execute(
      'create-review',
      {
        campaignId: campaign.uuid,
        authorId: SUBJECT,
        recipientId: PEER,
        text: 'Держал темп до конца потока, помогал с вопросами',
      },
      ACTOR,
    );
    expect(saved.recipientId).toBe(PEER);

    // Ментор пишет отзыв субъекту
    const savedMentor = await module.execute(
      'create-review',
      {
        campaignId: campaign.uuid,
        authorId: MENTOR,
        recipientId: SUBJECT,
        text: 'Стабильный результат и сильный финальный проект',
      },
      ACTOR,
    );
    expect(savedMentor.recipientId).toBe(SUBJECT);

    // ── Чтение: мои кампании различают роли и прогресс ──
    const subject = new UserCaller<Identified>({ uuid: SUBJECT });
    const mentor = new UserCaller<Identified>({ uuid: MENTOR });
    const subjectCards = expectOk(
      await campaignModule.dispatch(
        GetMyCampaignsUcDef.command({ onlyLives: true }),
        subject,
        REQ,
      ),
    );
    expect(subjectCards).toHaveLength(1);
    expect(subjectCards[0]?.myRole).toBe('subject');
    expect(subjectCards[0]?.progress).toEqual({ done: 1, total: 2 });

    const mentorCards = expectOk(
      await campaignModule.dispatch(
        GetMyCampaignsUcDef.command({ onlyLives: true }),
        mentor,
        REQ,
      ),
    );
    expect(mentorCards).toHaveLength(1);
    expect(mentorCards[0]?.myRole).toBe('mentor');
    expect(mentorCards[0]?.progress).toEqual({ done: 1, total: 1 });

    // Деталка: адресаты субъекта с признаком «мой отзыв есть»
    const recipients = expectOk(
      await campaignModule.dispatch(
        GetCampaignRecipientsUcDef.command({ campaignId: campaign.uuid }),
        subject,
        REQ,
      ),
    );
    const peerView = recipients.recipients.find((r) => r.userId === PEER);
    expect(peerView?.hasMyReview).toBe(true);

    // Чтение скоупа: отзывы сгруппированы по адресатам
    const scopeReviews = await module.execute(
      'list-scope-reviews',
      { scopeIds: [SCOPE] },
      ACTOR,
    );
    const byRecipient = new Map(
      scopeReviews.recipients.map((r) => [r.recipientId, r]),
    );
    expect(byRecipient.get(PEER)?.reviews).toHaveLength(1);
    expect(byRecipient.get(PEER)?.reviews[0]?.direction).toBe(
      'student_student',
    );
    expect(byRecipient.get(SUBJECT)?.reviews).toHaveLength(1);
    expect(byRecipient.get(SUBJECT)?.reviews[0]?.direction).toBe(
      'mentor_student',
    );
  });

  test('повторный отзыв той же паре перезаписывает, а не дублирует', async () => {
    const { module, campaigns } = makeVertical();
    const campaign = await openCampaign(campaigns);
    const write = (text: string) =>
      module.execute(
        'create-review',
        {
          campaignId: campaign.uuid,
          authorId: SUBJECT,
          recipientId: PEER,
          text,
        },
        ACTOR,
      );

    const first = await write('Первый вариант отзыва, достаточно длинный.');
    const second = await write('Второй вариант отзыва, достаточно длинный.');

    expect(second.reviewId).toBe(first.reviewId);
    const scopeReviews = await module.execute(
      'list-scope-reviews',
      { scopeIds: [SCOPE] },
      ACTOR,
    );
    const peer = scopeReviews.recipients.find((r) => r.recipientId === PEER);
    expect(peer?.reviews).toHaveLength(1);
  });
});
