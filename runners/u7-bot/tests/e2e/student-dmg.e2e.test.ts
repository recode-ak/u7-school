import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  ActivateStreamUcDef,
  CompleteStudentUcDef,
  CreateStreamUcDef,
  DropStudentUcDef,
  EnrollStudentUcDef,
  GetStudentByUserUcDef,
  InactivitySweepJobDef,
  MarkAbandonedUcDef,
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
 *   3) `abandoned` от студента (`dropStudent`) → ментору текст + мягкий кик;
 *   4) `abandoned` по бездействию (`markAbandoned`, inactivity) → студенту
 *      текст `warn` + кик;
 *   5) `abandoned` по решению ментора (`by_mentor`) → кик, студенту текст не
 *      приходит (Т6);
 *   6) `inactivityWarning` и `inactivityRemoveCandidate` через `runJob` →
 *      студенту «Учёба стоит», ментору «Кандидат на снятие с учёбы».
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

async function waitKick(
  transport: TestBotTransport,
  telegramId: number,
  timeoutMs = 3000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = transport.api.kickedMembers.find(
      (k) => k.telegramId === telegramId,
    );
    if (found) return found;
    await new Promise((r) => setTimeout(r, 20));
  }
  return undefined;
}

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  mentor: User;
  student: User;
}

async function createStand(tag: string): Promise<Stand> {
  const app = await createTestApp(tag);
  const transport = createTestBotTransport(app, [
    new StreamsController(),
    new MentorController(),
    new UserController(),
    new CoursesController(),
  ]);
  const mentor = (await app.userFacade.getUserByTelegramId(MENTOR_TG))!;
  const student = (await app.userFacade.getUserByTelegramId(STUDENT_TG))!;
  return { app, transport, mentor, student };
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

    expect(
      transport.api.sentMessages.find((m) => m.telegramId === STUDENT_TG),
    ).toBeUndefined();
  });
});

describe('E2E: abandoned от студента → ментору текст и кик', () => {
  let stand: Stand;
  beforeAll(async () => {
    stand = await createStand('student-dmg-drop');
  });
  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('dropStudent → ментору «покинул учёбу … по собственному желанию» + мягкий кик', async () => {
    const { app, transport, student } = stand;
    transport.reset();

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        DropStudentUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_F0,
        }),
        new UserCaller(student),
        trace(),
      ),
    );

    const text = await waitMessageFor(transport, MENTOR_TG);
    expect(text).toContain('покинул учёбу');
    expect(text).toContain('по собственному желанию');
    const kick = await waitKick(transport, STUDENT_TG);
    expect(String(kick?.chatId)).toBe(GROUP2_ID);
    expect(kick?.unbanned).toBe(true);
  });
});

describe('E2E: abandoned по бездействию → студенту текст и кик', () => {
  let stand: Stand;
  beforeAll(async () => {
    stand = await createStand('student-dmg-inactivity');
  });
  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('markAbandoned(inactivity) → студенту «снят с учёбы … за бездействие» + кик', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        MarkAbandonedUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_F0,
          cause: 'inactivity',
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );

    const kick = await waitKick(transport, STUDENT_TG);
    expect(String(kick?.chatId)).toBe(GROUP2_ID);
    expect(kick?.unbanned).toBe(true);
    const text = await waitMessageFor(transport, STUDENT_TG);
    expect(text).toContain('снят с учёбы');
    expect(text).toContain('за бездействие');
  });
});

describe('E2E: abandoned по решению ментора → кик без текста студенту', () => {
  let stand: Stand;
  beforeAll(async () => {
    stand = await createStand('student-dmg-by-mentor');
  });
  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('markAbandoned(by_mentor) → кик, студенту текст не приходит (Т6)', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        MarkAbandonedUcDef.command({
          streamId: STREAM2_ID,
          studentId: STUDENT_F0,
          cause: 'by_mentor',
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );

    expect(await waitKick(transport, STUDENT_TG)).toBeDefined();
    await new Promise((r) => setTimeout(r, 200));
    expect(
      transport.api.sentMessages.find((m) => m.telegramId === STUDENT_TG),
    ).toBeUndefined();
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

  test('runJob(inactivitySweep): студенту «Учёба стоит», ментору «Кандидат на снятие с учёбы»', async () => {
    const { app, transport } = stand;
    transport.reset();

    const report = expectOk(
      await app.runJob(StreamModuleDef, InactivitySweepJobDef),
    );
    expect(report.failed).toBe(0);

    const studentText = await waitMessageFor(transport, STUDENT_TG);
    expect(studentText).toContain('Учёба стоит');
    expect(studentText).toContain('снять тебя с учёбы');
    const mentorText = await waitMessageFor(transport, MENTOR_TG);
    expect(mentorText).toContain('Кандидат на снятие с учёбы');
    expect(mentorText).toContain('не занимался');
    // Маркер ставится до прогона: первое предупреждение — без строки «ранее отправлены»
    expect(mentorText).not.toContain('Уведомления были ранее отправлены');
  });

  test('повторный runJob в тот же день ничего не шлёт', async () => {
    const { app, transport } = stand;
    transport.reset();

    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    await new Promise((r) => setTimeout(r, 200));

    expect(transport.api.sentMessages).toEqual([]);
  });
});
