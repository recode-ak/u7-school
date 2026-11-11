import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  CreateReviewUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { Trace } from 'dmg-core/app';
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

async function waitUntil(
  probe: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}

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
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
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
