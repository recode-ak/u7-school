import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  CompleteStepUcDef,
  GetStudentProgressUcDef,
  InactivitySweepJobDef,
  MarkAbandonedUcDef,
  StreamModuleDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { envelopeOf } from '@u7-scl/test-helpers/envelope-of';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';

/**
 * E2E проактивов бездействия и ухода из учёбы (контракт «Диалог и Экран»):
 *   1) предупреждение студенту (5+ дней) — invite с кнопкой
 *      «🚪 Покинуть учёбу» (самовыход, FR-4);
 *   2) кандидат ментору (7+ дней, wasWarned) — invite с кнопкой
 *      «⚠️ Снять с учёбы» (FR-5);
 *   3) student.abandoned → мягкий кик из TG-группы потока (FR-6);
 *   4) нажатие кнопки самовыхода из invite → confirm-диалог → отмена;
 *   5) chat_member left активного студента → ментору «покинул группу»,
 *      статус студента не меняется (FR-7);
 *   6) mark-abandoned (UC) → abandoned + мягкий кик (FR-6);
 *   7) chat_member left выбывшего студента → уведомления нет (FR-7).
 *
 * Канал invite: получателю без открытого диалога
 * открывается экран app/invite (seq=1), кнопки штампуются и валидны.
 * Текстовые уведомления UC (drop-student / mark-abandoned) доставляются
 * через Def-подписки stories — механизм покрыт user-notify e2e.
 *
 * События job'а публикуются на общую шину (как в бою после inactivity-sweep);
 * кик выполняет InactivityStory через transport.kickFromGroup (ban + unban).
 * Два describe — отдельные фикстуры (сценарии 5–7 меняют статус студента).
 */

const STUDENT_TG = 1003; // «Студент» (active, поток e1e1e1e1)
const MENTOR_TG = 1004; // «Ментор» (ментор обоих потоков)

const STREAM2_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const STUDENT_F0 = 'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0';
const STUDENT_USER_ID = '33333333-3333-3333-3333-333333333333';
const GROUP2_ID = '-1002222222222';

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  student: U7BotActor;
  mentor: U7BotActor;
}

/** Стенд e2e: TestApp + TestBotTransport. */
async function createInactivityStand(tag: string): Promise<Stand> {
  const app = await createTestApp(tag);
  const transport = createTestBotTransport(app, [
    // Стори бездействия: kick из группы, уведомления о выбытии и завершении
    new StreamsController(),
  ]);
  const student = await app.userByTelegramId(STUDENT_TG);
  const mentor = await app.userByTelegramId(MENTOR_TG);

  return { app, transport, student, mentor };
}

/** Ждёт появления проактивного сообщения адресату (poll sentMessages). */
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

/** Ждёт проактивного сообщения с указанным фрагментом (poll sentMessages). */
async function waitMessageContaining(
  transport: TestBotTransport,
  telegramId: number,
  textContains: string,
  timeoutMs = 3000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = transport.api.sentMessages.find(
      (m) => m.telegramId === telegramId && m.text.includes(textContains),
    );
    if (found) return found.text;
    await new Promise((r) => setTimeout(r, 20));
  }
  return undefined;
}

/** Ждёт мягкого кика адресата (poll kickedMembers). */
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

/** Публикует событие-предупреждение job'а (ступень 5+ дней). */
function publishWarning(app: TestApp, daysInactive: number): void {
  app.eventBus.publish(
    envelopeOf(
      StudentEvents.inactivityWarning,
      {
        studentId: STUDENT_F0,
        userId: STUDENT_USER_ID,
        streamId: STREAM2_ID,
        days: daysInactive,
      },
      { aggregateId: STUDENT_F0 },
    ),
  );
}

/** Публикует событие-кандидата на снятие (ступень 7+ дней). */
function publishCandidate(
  app: TestApp,
  daysInactive: number,
  wasWarned: boolean,
): void {
  app.eventBus.publish(
    envelopeOf(
      StudentEvents.inactivityRemoveCandidate,
      {
        studentId: STUDENT_F0,
        userId: STUDENT_USER_ID,
        streamId: STREAM2_ID,
        days: daysInactive,
        wasWarned,
      },
      { aggregateId: STUDENT_F0 },
    ),
  );
}

/** Публикует событие ухода из учёбы (подписчик — мягкий кик, FR-6). */
function publishAbandoned(app: TestApp): void {
  app.eventBus.publish(
    envelopeOf(
      StudentEvents.abandoned,
      {
        studentId: STUDENT_F0,
        userId: STUDENT_USER_ID,
        streamId: STREAM2_ID,
        who: 'self',
        cause: 'voluntary',
      },
      { aggregateId: STUDENT_F0 },
    ),
  );
}

// ═══ Контур A: проактивы бездействия (FR-1) + callback-тупик (И3) ═══

describe('E2E: проактивы бездействия', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createInactivityStand('inactivity-proactive');
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('warning (5 дней) → студенту invite с кнопкой «🚪 Покинуть учёбу»', async () => {
    const { app, transport } = stand;
    transport.reset();

    publishWarning(app, 5);

    const text = await waitMessageFor(transport, STUDENT_TG);
    expect(text).toBeDefined();
    expect(text).toContain('Учёба стоит');
    expect(text).toContain('5 дней');
    expect(text).toContain('снять тебя с учёбы');
    expect(text).not.toContain('/start');
    // Кнопочный проактив: экран invite с единственной кнопкой самовыхода
    const msg = transport.api.sentMessages.find(
      (m) => m.telegramId === STUDENT_TG,
    );
    const btn = msg?.keyboard?.rows.flat()[0];
    expect(btn?.text).toBe('🚪 Покинуть учёбу');
    expect(btn?.code).toStartWith('stream:inactivity:drop-student:');
  });

  test('candidate (7 дней, wasWarned) → ментору invite с кнопкой «⚠️ Снять с учёбы»', async () => {
    const { app, transport } = stand;
    transport.reset();

    publishCandidate(app, 7, true);

    const text = await waitMessageFor(transport, MENTOR_TG);
    expect(text).toBeDefined();
    expect(text).toContain('Кандидат на снятие с учёбы');
    // Имя студента и группа резолвятся из профиля/потока
    expect(text).toContain('Студент');
    expect(text).toContain('JS Core — Поток 2');
    expect(text).toContain('не занимался 7 дней');
    expect(text).toContain('Уведомления были ранее отправлены');
    expect(text).not.toContain('Действия по студенту');
    // Кнопка снятия ведёт в confirm-сцену этой же стори
    const msg = transport.api.sentMessages.find(
      (m) => m.telegramId === MENTOR_TG,
    );
    const btn = msg?.keyboard?.rows.flat()[0];
    expect(btn?.text).toBe('⚠️ Снять с учёбы');
    expect(btn?.code).toStartWith('stream:inactivity:mark-abandoned:');
  });

  test('student.abandoned → мягкий кик из группы потока (FR-6)', async () => {
    const { app, transport } = stand;
    transport.reset();

    publishAbandoned(app);

    const kick = await waitKick(transport, STUDENT_TG);
    expect(kick).toBeDefined();
    expect(String(kick?.chatId)).toBe(GROUP2_ID);
    // Мягкость: ban на 60 секунд + мгновенный unban (можно вернуться)
    expect(kick?.unbanned).toBe(true);
  });

  test('нажатие кнопки самовыхода из invite → confirm-диалог → отмена (FR-4)', async () => {
    const { app, transport } = stand;
    transport.reset();

    // Предупреждение приносит экран invite студенту (seq=1)
    publishWarning(app, 5);
    await waitMessageFor(transport, STUDENT_TG);

    // Нажимаем отштампованную кнопку из invite
    const msg = transport.api.sentMessages.find(
      (m) => m.telegramId === STUDENT_TG,
    );
    const code = msg?.keyboard?.rows.flat()[0]?.code;
    expect(code).toBeDefined();

    const confirmResp = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, { callbackData: code! }),
    );
    expect(String(confirmResp.screen?.text)).toContain('Покинуть учёбу?');
    const cancelBtn = confirmResp.screen?.keyboard?.rows
      .flat()
      .find((b) => b.text === '❌ Остаться');
    expect(cancelBtn?.code).toBe('app:main-menu');

    // Отмена → главное меню (нажатие — отштампованной кнопкой)
    const menuResp = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, {
        callbackData: pressedCode(transport, STUDENT_TG, 'Остаться'),
      }),
    );
    expect(String(menuResp.screen?.text)).toContain('Главное меню');
  });
});

// ═══ Контур B: выход из группы + снятие ментором (FR-6/7) ═══

describe('E2E: выход из группы и снятие ментором', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createInactivityStand('inactivity-group-left');
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('chat_member left активного студента → ментору «покинул группу», статус не меняется (FR-7)', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();

    await transport.uiApp.handleMessengerEvent({
      kind: 'member_left',
      chatId: GROUP2_ID,
      user: { id: STUDENT_TG, firstName: 'Студент' },
    });

    const notice = await waitMessageFor(transport, MENTOR_TG);
    expect(notice).toBeDefined();
    expect(notice).toContain('покинул группу');

    // Статус студента не изменился — решение об уходе принимают люди
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: STUDENT_F0 }),
        mentor,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    ).student;
    expect(record.status).toBe('active');
  });

  test('mark-abandoned (UC) → abandoned + мягкий кик (FR-6)', async () => {
    const { app, transport, mentor } = stand;
    transport.reset();

    // UC напрямую (в бою — кнопка в monitor):
    // снимает студента, публикует student.abandoned и уведомляет студента
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        MarkAbandonedUcDef.command({
          studentId: STUDENT_F0,
          streamId: STREAM2_ID,
          cause: 'inactivity',
        }),
        mentor,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    );

    // Студент abandoned в репозитории
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: STUDENT_F0 }),
        mentor,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    ).student;
    expect(record.status).toBe('abandoned');

    // Мягкий кик из группы потока
    const kick = await waitKick(transport, STUDENT_TG);
    expect(kick).toBeDefined();
    expect(String(kick?.chatId)).toBe(GROUP2_ID);
    expect(kick?.unbanned).toBe(true);

    // Студенту доставлено уведомление UC (полный механизм — user-notify e2e)
    const studentNotice = await waitMessageFor(transport, STUDENT_TG);
    expect(studentNotice).toContain('снят с учёбы');
  });

  test('chat_member left выбывшего студента → ментору уведомления нет (FR-7)', async () => {
    const { transport } = stand;
    transport.reset();

    await transport.uiApp.handleMessengerEvent({
      kind: 'member_left',
      chatId: GROUP2_ID,
      user: { id: STUDENT_TG, firstName: 'Студент' },
    });
    await new Promise((r) => setTimeout(r, 200));

    const noticed = transport.api.sentMessages.find(
      (m) => m.telegramId === MENTOR_TG,
    );
    // Студент уже abandoned — ментору «покинул группу» не приходит
    expect(noticed?.text ?? '').not.toContain('покинул группу');
  });
});

// ═══ Контур C: подтверждения ухода (callback-сцены стори inactivity) ═══

/** Студент и ментор, нужные сценам подтверждения (свои у каждого актора). */
const OLEG_TG = 1008; // «Олег» — запись f2f2 со статусом not_advanced
const OLEG_STUDENT_ID = 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2';
const MARINA_STUDENT_ID = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1';

/** Стенд сцен подтверждения: экран `/start` имеет кнопки (AppController). */
async function createConfirmStand(tag: string): Promise<Stand> {
  const app = await createTestApp(tag);
  const transport = createTestBotTransport(app, [
    new AppController('https://t.me/u7_school_group'),
    new StreamsController(),
  ]);
  return {
    app,
    transport,
    student: await app.userByTelegramId(STUDENT_TG),
    mentor: await app.userByTelegramId(MENTOR_TG),
  };
}

describe('E2E: подтверждения ухода из учёбы (callback-сцены)', () => {
  let stand: Stand;
  let oleg: U7BotActor;

  beforeAll(async () => {
    // Свой стенд: `/start` даёт экран с кнопками (AppController — системные
    // и главное меню), по штампу которого крафтятся коды сцен подтверждения
    stand = await createConfirmStand('inactivity-confirms');
    oleg = await stand.app.userByTelegramId(OLEG_TG);
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('P8-11: «⚠️ Снять с учёбы» → экран подтверждения с именем студента', async () => {
    const { transport } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(MENTOR_TG, {
        callbackData: stampedCode(
          transport,
          MENTOR_TG,
          `stream:inactivity:mark-abandoned:${STUDENT_F0}`,
        ),
      }),
    );

    const text = String(response.screen?.text);
    expect(text).toContain('Снять студента *Андрей* с учёбы за бездействие?');
    expect(text).toContain('исключён из группы потока');
    const buttons = response.screen?.keyboard?.rows.flat() ?? [];
    expect(buttons.map((b) => b.text)).toEqual([
      '⚠️ Да, снять с учёбы',
      '❌ Отмена',
    ]);
    // Отмена возвращает в главное меню — это якорь, не действие стори
    expect(buttons[1]?.code).toBe('app:main-menu');
  });

  test('P8-12: «⚠️ Снять с учёбы» с недоступной записью → «Запись студента не найдена»', async () => {
    const { transport } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(MENTOR_TG, {
        callbackData: stampedCode(
          transport,
          MENTOR_TG,
          `stream:inactivity:mark-abandoned:${crypto.randomUUID()}`,
        ),
      }),
    );

    expect(String(response.screen?.text)).toContain(
      '⚠️ Запись студента не найдена',
    );
    expect(response.screen?.keyboard).toBeUndefined();
  });

  test('P8-09: `drop-student-confirm` с недоступной записью → «Запись студента не найдена»', async () => {
    const { transport } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(STUDENT_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, {
        callbackData: stampedCode(
          transport,
          STUDENT_TG,
          `stream:inactivity:drop-student-confirm:${crypto.randomUUID()}`,
        ),
      }),
    );

    expect(String(response.screen?.text)).toContain(
      '⚠️ Запись студента не найдена',
    );
  });

  test('P8-10: `drop-student-confirm` с отказом UC (уже не учится) → warn-реплика вместо экрана', async () => {
    const { transport } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(OLEG_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(OLEG_TG, {
        callbackData: stampedCode(
          transport,
          OLEG_TG,
          `stream:inactivity:drop-student-confirm:${OLEG_STUDENT_ID}`,
        ),
      }),
    );

    // Намеренное отличие от v0.2.6 (там — общий экран ошибки): отказ UC
    // отдаётся репликой `ucErrorNotify` с текстом ошибки домена
    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain(
      'Нельзя снять студента с учёбы: он уже не учится',
    );
    // Запись олега не тронута — он по-прежнему not_advanced
    const olegRecord = expectOk(
      await stand.app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: OLEG_STUDENT_ID }),
        oleg,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    ).student;
    expect(olegRecord.status).toBe('not_advanced');
  });

  test('P8-14: `mark-abandoned-confirm` с отказом UC → warn-реплика, снятия нет', async () => {
    const { transport, mentor } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(MENTOR_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(MENTOR_TG, {
        callbackData: stampedCode(
          transport,
          MENTOR_TG,
          `stream:inactivity:mark-abandoned-confirm:${MARINA_STUDENT_ID}`,
        ),
      }),
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain(
      'Нельзя снять студента с учёбы: он уже не учится',
    );
    // Марина осталась advanced — статус не изменился
    const record = expectOk(
      await stand.app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: MARINA_STUDENT_ID }),
        mentor,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    ).student;
    expect(record.status).toBe('advanced');
  });

  test('P8-16: callback невалидного вида внутри `inactivity` → «⚠️ Неизвестная команда»', async () => {
    const { transport } = stand;
    transport.reset();
    await transport.handleStart(transport.makeBotContext(STUDENT_TG));

    const response = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, {
        callbackData: stampedCode(
          transport,
          STUDENT_TG,
          'stream:inactivity:xyz',
        ),
      }),
    );

    expect(String(response.screen?.text)).toContain('⚠️ Неизвестная команда');
  });

  test('P8-08: самовыход целиком — confirm → прощание, ментор получает уведомление (P1-55)', async () => {
    const { app, transport, student } = stand;

    // Студент — через предупреждение бездействия: экран invite с кнопкой
    publishWarning(app, 5);
    await waitMessageContaining(transport, STUDENT_TG, 'Учёба стоит');
    const dropCode = transport.api.sentMessages
      .filter((m) => m.telegramId === STUDENT_TG)
      .at(-1)
      ?.keyboard?.rows.flat()[0]?.code;
    if (dropCode === undefined) {
      throw new Error('invite без кнопки самовыхода');
    }

    // Шаг 1: кнопка «Покинуть учёбу» → confirm
    const confirm = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, { callbackData: dropCode }),
    );
    expect(String(confirm.screen?.text)).toContain('Покинуть учёбу?');

    // Шаг 2: «🚪 Да, покинуть» → прощание + UC drop-student
    const done = await transport.handleCallback(
      transport.makeBotContext(STUDENT_TG, {
        callbackData: pressedCode(transport, STUDENT_TG, 'Да, покинуть'),
      }),
    );
    expect(String(done.screen?.text)).toContain('Ты покинул учёбу');
    expect(String(done.screen?.text)).toContain('возвращайся');

    // Ментору — уведомление о самовыходе (P1-55)
    const mentorNotice = await waitMessageContaining(
      transport,
      MENTOR_TG,
      'покинул учёбу',
    );
    expect(mentorNotice).toBeDefined();
    expect(mentorNotice).toContain('ℹ️ *Информация:*');
    expect(mentorNotice).toContain('Студент Андрей покинул учёбу');
    expect(mentorNotice).toContain('JS Core — Поток 2');
    expect(mentorNotice).toContain('по собственному желанию');

    // Статус записи — abandoned
    const record = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: STUDENT_F0 }),
        student,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    ).student;
    expect(record.status).toBe('abandoned');
  });
});

// ═══ Контур D: Job бездействия по дням (управляемые часы) ═══

describe('E2E: Job бездействия — повторы по дням', () => {
  let stand: Stand;
  let app: TestApp & { clock: NonNullable<TestApp['clock']> };

  beforeAll(async () => {
    app = (await createTestApp('inactivity-clock', undefined, {
      clock: {},
    })) as TestApp & { clock: NonNullable<TestApp['clock']> };
    const transport = createTestBotTransport(app, [new StreamsController()]);
    stand = {
      app,
      transport,
      student: await app.userByTelegramId(STUDENT_TG),
      mentor: await app.userByTelegramId(MENTOR_TG),
    };
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  test('P8-04: прогон в якорный день, тишина через день, повтор через два', async () => {
    const { transport } = stand;
    transport.reset();

    // День 0 (якорь 2026-09-23): 15 дней бездействия — обе ступени
    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    const toStudent = await waitMessageFor(transport, STUDENT_TG);
    expect(toStudent).toContain('Ты не занимаешься уже 15 дней');
    const toMentor = await waitMessageFor(transport, MENTOR_TG);
    expect(toMentor).toContain('не занимался 15 дней');
    expect(toMentor).not.toContain('Уведомления были ранее отправлены');

    // +1 день: окно повтора (2 дня) не открылось — тишина
    transport.reset();
    app.clock.advance(24 * 60 * 60 * 1000);
    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    await new Promise((r) => setTimeout(r, 200));
    expect(transport.api.sentMessages).toEqual([]);

    // +2 дня: повтор обеим ступеням, ментор видит «уведомления были»
    app.clock.advance(24 * 60 * 60 * 1000);
    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    const secondStudent = await waitMessageFor(transport, STUDENT_TG);
    expect(secondStudent).toContain('Ты не занимаешься уже 17 дней');
    const secondMentor = await waitMessageFor(transport, MENTOR_TG);
    expect(secondMentor).toContain('не занимался 17 дней');
    expect(secondMentor).toContain('Уведомления были ранее отправлены');
  });

  test('P8-04: завершение шага сбрасывает цепочку — Job молчит', async () => {
    const { transport, student } = stand;
    transport.reset();

    // Студент вернулся к учёбе: шаг завершён — активность обновилась
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStepUcDef.command({
          studentId: STUDENT_F0,
          streamId: STREAM2_ID,
          stepId: 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0',
        }),
        student,
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    );

    // Через 3 дня окно повтора открыто (маркер старше 2 дней), но
    // бездействие — 3 дня < порога 5: цепочка сброшена активностью
    app.clock.advance(3 * 24 * 60 * 60 * 1000);
    expectOk(await app.runJob(StreamModuleDef, InactivitySweepJobDef));
    await new Promise((r) => setTimeout(r, 200));
    expect(transport.api.sentMessages).toEqual([]);
  });
});
