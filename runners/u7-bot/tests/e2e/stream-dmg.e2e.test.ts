import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { CoursesController } from '../../src/controllers/courses/controller';

/**
 * E2E шины бота на DMG: событие «ушёл из группы» → контроллер потоков →
 * уведомление ментору (поток — legacy-запись фикстуры, студент — legacy-мост).
 */

const MENTOR_TG = 1004;
const STUDENT_TG = 1003; // active на потоке e1e1e1e1, группа GROUP2_ID
const GROUP2_ID = '-1002222222222';

async function waitMessageFor(
  transport: TestBotTransport,
  telegramId: number,
  timeoutMs = 3000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = transport.api.sentMessages.find(
      (m) => m.telegramId === telegramId,
    );
    if (found) return found.text;
    await new Promise((r) => setTimeout(r, 20));
  }
  return undefined;
}

describe('E2E: поток на DMG', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let mentor: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('stream-dmg-e2e');
    transport = createTestBotTransport(app, [
      new StreamsController(),
      new CoursesController(),
    ]);
    mentor = await app.userByTelegramId(MENTOR_TG);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('в группе потока ушёл активный студент → ментору «покинул группу» (FR-7)', async () => {
    transport.reset();

    await transport.uiApp.handleMessengerEvent({
      kind: 'member_left',
      chatId: GROUP2_ID,
      user: { id: STUDENT_TG, firstName: 'Студент' },
    });

    const notice = await waitMessageFor(transport, MENTOR_TG);
    expect(notice).toContain('покинул группу');
  });
});
