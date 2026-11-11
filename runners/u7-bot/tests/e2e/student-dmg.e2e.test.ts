import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  CompleteStudentUcDef,
  InactivitySweepJobDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { CoursesController } from '../../src/controllers/courses/controller';
import { UserController } from '../../src/controllers/user/controller';

/**
 * E2E событий студента потока на DMG (срез `student`): события публикует UoW
 * модуля `stream` при настоящем UC (`dispatch`) или Job (`runJob`), а не
 * публикация legacy-имени `student.*` на шине.
 * Текущий сценарий: повторный `runJob` в тот же день → ничего не шлёт
 * (маркер бездействия).
 *
 * Допущение о стенде: `TestApp.runJob(module, jobDef)` запускает Job через
 * приложение DMG (в `createTestApp` его нет — добавляет автор, тесты
 * harness'а не ослабляются).
 * Фикстура: студент f0f0 (1003) active на потоке e1e1 (ментор 1004, группа
 * GROUP2_ID); последняя активность — 2026-09-08, поэтому Job видит 5+/7+ дней.
 */

const MENTOR_TG = 1004;
const STUDENT_TG = 1003;
const GROUP2_ID = '-1002222222222';

const trace = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

async function waitMessageFor(
  transport: TestBotTransport,
  telegramId: number,
  timeoutMs = 3000,
) {
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

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  mentor: User;
}

async function createStand(tag: string): Promise<Stand> {
  const app = await createTestApp(tag);
  const transport = createTestBotTransport(app, [
    new StreamsController(),
    new LearningController(),
    new MentorController(),
    new UserController(),
    new CoursesController(),
  ]);
  const mentor = (await app.userFacade.getUserByTelegramId(MENTOR_TG))!;
  return { app, transport, mentor };
}

describe('E2E: Job бездействия → проактивы студенту и ментору', () => {
  let stand: Stand;
  beforeAll(async () => {
    stand = await createStand('student-dmg-job');
  });
  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('повторный runJob в тот же день ничего не шлёт', async () => {
    const { app, transport } = stand;

    // Первый прогон ставит маркеры «предупреждён сегодня» — ждём доставки
    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    await waitMessageFor(transport, STUDENT_TG);
    await waitMessageFor(transport, MENTOR_TG);
    transport.reset();

    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    await new Promise((r) => setTimeout(r, 200));

    expect(transport.api.sentMessages).toEqual([]);
  });
});
