import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  GetStudentByUserUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { expectOk, testTrace } from 'dmg-core/testing';

/**
 * E2E самовыхода из учёбы (FR-4, восстановление интерактивности после
 * [7034c7e]): кнопка «🚪 Покинуть учёбу» в меню хаба → confirm-диалог →
 * UC dropStudent → студент abandoned, мягкий кик из TG-группы потока
 * (FR-6, событие StudentEvents.abandoned → InactivityStory).
 *
 * Фикстуры: студент tg 1003 → student f0f0f0f0 → поток e1e1e1e1
 * (active, TG-группа -1002222222222).
 */
describe('E2E: Самовыход из учёбы (learning/hub, FR-4/FR-6)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let student: U7BotActor;

  const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
  const STREAM_GROUP_ID = -1002222222222;

  beforeAll(async () => {
    app = await createTestApp('learning-self-drop-e2e');
    const streamController = new StreamsController();
    const learningController = new LearningController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    transport = createTestBotTransport(app, [
      appController,
      streamController,
      learningController,
    ]);
    student = await app.userByTelegramId(1003);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('сценарий из меню: Моя учёба → Покинуть учёбу → confirm → кик из группы', async () => {
    const tgId = student.user.view().telegramId;

    // 1. /start — главное меню, диалог открыт
    await transport.handleStart(transport.makeBotContext(tgId));

    // 2. «🎓 Моя учёба» — хаб
    const hubResp = await transport.press(tgId, 'Моя учёба');
    expect(String(hubResp.screen?.text)).toContain('Моя учёба');

    // 3. «🚪 Покинуть учёбу» — confirm-диалог
    const confirmResp = await transport.press(tgId, 'Покинуть учёбу');
    const confirmText = String(confirmResp.screen?.text);
    expect(confirmText).toContain('Покинуть учёбу');
    expect(confirmText).toContain('Прогресс сохранится');

    // 4. «🚪 Да, покинуть» — UC drop-student, реплика прощания
    const leaveResp = await transport.press(tgId, 'Да, покинуть');
    const leaveText = String(leaveResp.screen?.text);
    expect(leaveText).toContain('Ты покинул учёбу');

    // 5. FR-6: студент мягко исключён из TG-группы потока (ban + unban);
    // событие abandoned доставляется шиной после ответа UC — ждём кик
    const deadline = Date.now() + 3000;
    while (
      Date.now() < deadline &&
      !transport.api.kickedMembers.some((k) => k.telegramId === tgId)
    ) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const kicks = transport.api.kickedMembers.filter(
      (k) => k.telegramId === tgId,
    );
    expect(kicks.length).toBe(1);
    expect(Number(kicks[0]!.chatId)).toBe(STREAM_GROUP_ID);
    expect(kicks[0]!.unbanned).toBe(true);

    // 6. Студент переведён в abandoned (проверка через домен)
    const studentAfter = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentByUserUcDef.command({ userId: student.user.uuid }),
        student,
        testTrace(),
      ),
    );
    expect(studentAfter.status).toBe('abandoned');
  });

  test('после самовыхода студент теряет кнопку «Моя учёба» в меню (нет живой записи)', async () => {
    // stream роль STUDENT не снимает: меню опирается на живую запись
    // студента (getActiveStudent), а не на роль
    const fresh = await app.userByTelegramId(student.user.view().telegramId);

    const menu = await transport.collectMainMenu(fresh);
    expect(menu.some((i) => i.text.includes('Моя учёба'))).toBe(false);
  });
});
