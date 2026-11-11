import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  ActivateStreamUcDef,
  CompleteStudentUcDef,
  CreateStreamUcDef,
  EnrollStudentUcDef,
  GetStudentByUserUcDef,
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
 *   1) `completed` (advanced, последний модуль) → студенту «🎉 Курс завершён!» (7c);
 *   2) `completed` (advanced, есть следующий модуль) → студенту ничего (7a/7b —
 *      кнопки HubStory);
 *   3) повторный `runJob` в тот же день → ничего не шлёт (маркер бездействия).
 *
 * Допущение о стенде: `TestApp.runJob(module, jobDef)` запускает Job через
 * приложение DMG (в `createTestApp` его нет — добавляет автор, тесты
 * harness'а не ослабляются).
 * Фикстура: студент f0f0 (1003) active на потоке e1e1 (ментор 1004, группа
 * GROUP2_ID); последняя активность — 2026-09-08, поэтому Job видит 5+/7+ дней.
 */

const MENTOR_TG = 1004;
const STUDENT_TG = 1003;
const STUDENT_ADV_TG = 1007; // «Марина» (прошла a0a0a0a0)
const STUDENT_F0 = 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0';
const STREAM2_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const GROUP2_ID = '-1002222222222';
const LAST_MODULE = 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'; // Алгоритмика (последняя фаза)

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

describe('E2E: completed → уведомление студенту (7a/7b/7c)', () => {
  let stand: Stand;
  beforeAll(async () => {
    stand = await createStand('student-dmg-completed');
  });
  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('advanced на последнем модуле → «🎉 Курс завершён!» (7c)', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();
    const marina = (await app.userFacade.getUserByTelegramId(STUDENT_ADV_TG))!;

    const stream = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Алгоритмика — Финальный поток',
          description: 'Последний модуль программы',
          moduleId: LAST_MODULE,
          startDate: Date.UTC(2026, 10, 1),
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        EnrollStudentUcDef.command({ streamId: stream.streamId }),
        new UserCaller(marina),
        trace(),
      ),
    );
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentByUserUcDef.command({ userId: marina.uuid }),
        new UserCaller(mentor),
        trace(),
      ),
    );
    expect(record.streamId).toBe(stream.streamId);
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        ActivateStreamUcDef.command({ streamId: stream.streamId }),
        new UserCaller(mentor),
        trace(),
      ),
    );

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: stream.streamId,
          studentId: record.uuid,
          outcome: 'advanced',
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );

    const text = await waitMessageFor(transport, STUDENT_ADV_TG);
    expect(text).toContain('Курс завершён');
    expect(text).toContain('Поздравляем');
  });

  test('advanced на модуле со следующим → студенту уведомления нет', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_F0,
          outcome: 'advanced',
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );
    await new Promise((r) => setTimeout(r, 200));

    // HubStory (стенд с LearningController) шлёт кнопочное приглашение 7a;
    // безкнопочного текста 7c/7d нет
    const toStudent = transport.api.sentMessages.filter(
      (m) => m.telegramId === STUDENT_TG,
    );
    expect(toStudent.map((m) => m.text).join('\n')).toContain(
      'записаться на следующий',
    );
    expect(toStudent.some((m) => m.text.includes('Курс завершён'))).toBe(false);
  });
});

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
