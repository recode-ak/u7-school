import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  CreateReviewUcDef,
  PeerReviewModuleDef,
  ReviewEvents,
} from '@u7-scl/domain/peer-review/contract';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { waitUntil } from '@u7-scl/test-helpers/wait-until';
import type { AnyEventDef } from 'dmg-core';
import type { EventBus } from 'dmg-core/app';
import { testTrace } from 'dmg-core/testing';
import * as v from 'valibot';
import { PeerReviewController } from '../../src/controllers/peer-review/controller';
import { completeStudent } from '../helpers/student-fate';

/**
 * E2E уведомления адресата: первая запись отзыва через `dispatch` →
 * событие `peer-review.review.created` → `ReviewNotifyStory` шлёт адресату
 * проактивное сообщение; перезапись той же пары уведомления не даёт.
 */

const STREAM_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const SUBJECT_TG = 1007; // «Марина» — субъект новой кампании
const SUBJECT_USER_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004;
const MENTOR_USER_ID = '44444444-4444-4444-4444-444444444444';
const NOTICE = 'У тебя новый отзыв';

describe('E2E peer-review: уведомление адресата о новом отзыве', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-notify');
    transport = createTestBotTransport(app, [new PeerReviewController()]);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  const notices = () =>
    transport.api.sentMessages.filter(
      (m) => m.telegramId === MENTOR_TG && String(m.text).includes(NOTICE),
    );

  test('первая запись → уведомление ментору; перезапись пары — без уведомления', async () => {
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_ID,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });
    await waitUntil(() =>
      transport.api.sentMessages.some((m) => m.telegramId === SUBJECT_TG),
    );
    const campaign = (await app.reviewCampaignRepo.findBySubject(
      STREAM_ID,
      SUBJECT_USER_ID,
    ))!;
    const subject = await app.userByTelegramId(SUBJECT_TG);

    const write = (text: string) =>
      app.apiApp.dispatch(
        PeerReviewModuleDef,
        CreateReviewUcDef.command({
          campaignId: campaign.uuid,
          recipientId: MENTOR_USER_ID,
          text,
        }),
        subject,
        testTrace(),
      );

    expect((await write('Ментор объяснял терпеливо и по делу.')).ok).toBe(true);
    await waitUntil(() => notices().length > 0);
    expect(notices()).toHaveLength(1);
    expect(String(notices()[0]?.text)).toContain('Марина');
    expect(String(notices()[0]?.text)).toContain('твой студент');

    expect((await write('Правка: ещё и разбирал ошибки подробно.')).ok).toBe(
      true,
    );
    await new Promise((r) => setTimeout(r, 150));
    expect(notices()).toHaveLength(1);
  });
});

const LOST_USER_ID = 'dead0003-0000-4000-8000-000000000003';

/** Публикует Def-событие на общей шине (payload валидируется схемой Def). */
function publish<E extends AnyEventDef>(
  bus: EventBus,
  event: E,
  payload: v.InferInput<E['payload']>,
): void {
  bus.publish(
    envelopeOf(event, v.parse(event.payload, payload) as never, {
      eventId: crypto.randomUUID(),
    }),
  );
}

describe('E2E peer-review: уведомление — направление и молчаливые пропуски', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('pr-notify-gaps');
    transport = createTestBotTransport(app, [new PeerReviewController()]);
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_ID,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });
    await waitUntil(async () =>
      Boolean(
        await app.reviewCampaignRepo.findBySubject(STREAM_ID, SUBJECT_USER_ID),
      ),
    );
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P6-38: ментор написал студенту — «автор …, твой ментор»', async () => {
    const campaign = (await app.reviewCampaignRepo.findBySubject(
      STREAM_ID,
      SUBJECT_USER_ID,
    ))!;
    const mentor = await app.userByTelegramId(MENTOR_TG);

    const written = await app.apiApp.dispatch(
      PeerReviewModuleDef,
      CreateReviewUcDef.command({
        campaignId: campaign.uuid,
        recipientId: SUBJECT_USER_ID,
        text: 'Марина стабильно выполняла задания и задавала точные вопросы.',
      }),
      mentor,
      testTrace(),
    );
    expect(written.ok).toBe(true);

    await waitUntil(() =>
      transport.api.sentMessages.some(
        (m) => m.telegramId === SUBJECT_TG && String(m.text).includes(NOTICE),
      ),
    );
    const notice = transport.api.sentMessages.find(
      (m) => m.telegramId === SUBJECT_TG && String(m.text).includes(NOTICE),
    );
    // Роль автора — по направлению mentor→student; имя — из batch-профиля
    expect(String(notice?.text)).toContain('Алексей');
    expect(String(notice?.text)).toContain('твой ментор');
    expect(String(notice?.text)).toContain('💬 Отзывы');
  });

  test('P6-39: автор отзыва не найден — уведомление молча не отправлено', async () => {
    const before = transport.api.sentMessages.length;
    publish(app.eventBus, ReviewEvents.created, {
      reviewId: crypto.randomUUID(),
      campaignId: crypto.randomUUID(),
      scopeId: STREAM_ID,
      authorId: LOST_USER_ID,
      recipientId: SUBJECT_USER_ID,
      direction: 'mentor_student',
    });
    await new Promise((r) => setTimeout(r, 250));

    // Ни сообщения адресату, ни исключения в шине: только warn в лог
    expect(
      transport.api.sentMessages
        .slice(before)
        .filter((m) => String(m.text).includes(NOTICE)),
    ).toHaveLength(0);
  });
});
