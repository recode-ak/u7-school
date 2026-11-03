import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  CreateStreamUcDef,
  FindStreamByTelegramGroupUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  CreateCourseWishUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { GuestCaller, UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { CoursesController } from '../../src/controllers/courses/controller';
import { UserController } from '../../src/controllers/user/controller';

/**
 * E2E потока на DMG:
 *   1) `createStream` → ER invite-wishers → желающему одно приглашение
 *      (событие `stream.created` публикует UoW модуля, не legacy-агрегат);
 *   2) `findStreamByTelegramGroup`: поток находится по группе, чужая группа —
 *      пусто;
 *   3) в группе нового потока вступил чужой → ментору предупреждение;
 *   4) в группе потока ушёл активный студент → ментору «покинул группу»
 *      (поток — legacy-запись фикстуры, студент — legacy-мост);
 *   5) событие в чужой группе → pass, никому ничего не уходит.
 */

const COURSE_ID = 'fafafafa-baba-4aba-8aba-babababababa';
const FIRST_MODULE = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
const MENTOR_TG = 1004;
const WISHER_TG = 1002;
const STUDENT_TG = 1003; // active на потоке e1e1e1e1, группа GROUP2_ID
const GROUP2_ID = '-1002222222222';
const NEW_GROUP = '-1007777777777';

const trace = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

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
  let mentor: User;
  let wisher: User;
  let streamId: string;

  beforeAll(async () => {
    app = await createTestApp('stream-dmg-e2e');
    transport = createTestBotTransport(app, [
      new StreamsController(),
      new UserController(),
      new CoursesController(),
    ]);
    mentor = (await app.userFacade.getUserByTelegramId(MENTOR_TG))!;
    wisher = (await app.userFacade.getUserByTelegramId(WISHER_TG))!;
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

  test('createStream → желающий получает ровно одно приглашение', async () => {
    transport.reset();
    expectOk(
      await app.apiApp.dispatch(
        WishModuleDef,
        CreateCourseWishUcDef.command({ courseId: COURSE_ID }),
        new UserCaller(wisher),
        trace(),
      ),
    );

    const created = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Основы JS — Поток осени',
          description: 'Набор на первый модуль',
          moduleId: FIRST_MODULE,
          startDate: Date.UTC(2026, 9, 1),
          telegramGroupId: NEW_GROUP,
        }),
        new UserCaller(mentor),
        trace(),
      ),
    );
    streamId = created.streamId;

    const text = await waitMessageFor(transport, WISHER_TG);
    expect(text).toContain('📣 *Открылся набор\\!*');
    expect(text).toContain('Поток: «Основы JS — Поток осени»');
    expect(text).toContain('Старт: 01\\.10\\.2026, 00:00');
    expect(text).toContain('Запись свободная');
    const invites = transport.api.sentMessages.filter(
      (m) => m.telegramId === WISHER_TG && m.text.includes('Открылся набор'),
    );
    expect(invites).toHaveLength(1);
  });

  test('findStreamByTelegramGroup: поток по группе; чужая группа — пусто', async () => {
    const found = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        FindStreamByTelegramGroupUcDef.command({ telegramGroupId: NEW_GROUP }),
        new GuestCaller(),
        trace(),
      ),
    );
    expect(found?.uuid).toBe(streamId);
    expect(found?.mentorId).toBe(mentor.uuid);

    const none = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        FindStreamByTelegramGroupUcDef.command({
          telegramGroupId: '-1009999999999',
        }),
        new GuestCaller(),
        trace(),
      ),
    );
    expect(none).toBeUndefined();
  });

  test('в группе нового потока вступил чужой → ментору предупреждение', async () => {
    transport.reset();

    await transport.uiApp.handleMessengerEvent({
      kind: 'member_joined',
      chatId: NEW_GROUP,
      user: { id: 424242, firstName: 'Аноним', username: 'anon' },
    });

    const notice = await waitMessageFor(transport, MENTOR_TG);
    expect(notice).toContain('Основы JS — Поток осени');
    expect(notice).toContain('Аноним');
    expect(notice).toContain('не числится студентом этого потока');
  });

  test('событие в чужой группе → никому ничего не уходит', async () => {
    transport.reset();

    await transport.uiApp.handleMessengerEvent({
      kind: 'member_joined',
      chatId: '-1009999999999',
      user: { id: 424242, firstName: 'Аноним' },
    });
    await new Promise((r) => setTimeout(r, 200));

    expect(transport.api.sentMessages).toEqual([]);
  });
});
