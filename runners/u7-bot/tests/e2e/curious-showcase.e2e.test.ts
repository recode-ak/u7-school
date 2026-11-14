import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/domain/user/testing';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import {
  CORE_EDUCATION_ANCHOR,
  CORE_EDUCATION_WORLD,
  type WorldDefinition,
} from '../worlds';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** Экран в хронологии отображения: sent или edit (text + keyboard). */
interface ScreenRecord {
  text: string;
  keyboard?: { rows: Array<Array<{ text: string; code: string }>> };
}

/**
 * E2E: Витрина для любопытного (курсы + потоки, контракт «Диалог и Экран»).
 *
 * Паттерн нажатий: перед нажатием экран открыт (/start или предыдущая
 * кнопка), код берётся отштампованным из Api-записи (pressedCode) —
 * как реальный клиент. Содержимое ответа ассертится по DialogResponse,
 * захваченному на границе uiApp (screen/notify разделены).
 */

/**
 * Экраны пользователя в порядке отображения (новые первее).
 *
 * Api-записи ведут два массива (sent/edited); edit рендерит СУЩЕСТВУЮЩЕЕ
 * сообщение (messageId оригинала), поэтому хронология восстанавливается
 * так: sent-ы по порядку, каждый edit — сразу за своим sent. Простая
 * склейка [...edited, ...sent] даёт неверный порядок, когда edit-экраны
 * (дрill-down одной стори) чередуются с send-экранами (смена стори).
 */
function screensNewFirst(
  transport: TestBotTransport,
  tgId: number,
): ScreenRecord[] {
  const editsByMessageId = new Map<number, ScreenRecord[]>();
  for (const e of transport.api.editedMessages) {
    if (e.telegramId !== tgId) continue;
    const list = editsByMessageId.get(e.messageId) ?? [];
    list.push(e);
    editsByMessageId.set(e.messageId, list);
  }
  const merged: ScreenRecord[] = [];
  for (const s of transport.api.sentMessages) {
    if (s.telegramId !== tgId) continue;
    merged.push(s);
    merged.push(...(editsByMessageId.get(s.messageId) ?? []));
  }
  return merged.reverse();
}

/** Отштампованный код кнопки с последнего экрана пользователя (Api-запись). */
function pressedCode(
  transport: TestBotTransport,
  tgId: number,
  textContains: string,
): string {
  const screens = screensNewFirst(transport, tgId);
  for (const screen of screens) {
    const btn = screen.keyboard?.rows
      .flat()
      .find((b) => b.text.includes(textContains));
    if (btn) return btn.code;
  }
  throw new Error(
    `Кнопка «${textContains}» не найдена на экранах ${tgId} ` +
      `(перед нажатием открой экран через /start или кнопку).`,
  );
}

/** Текст экрана ответа (пустая строка, если экрана не было). */
function textOfResponse(response: DialogResponse): string {
  return String(response.screen?.text ?? '');
}

/** Подписи кнопок экрана. */
function buttonsOfResponse(response: DialogResponse): string[] {
  return (response.screen?.keyboard?.rows.flat() ?? []).map((b) => b.text);
}

/** Нажатие кнопки по подстроке подписи (код — из Api-записей). */
function pressByText(
  transport: TestBotTransport,
  tgId: number,
  textContains: string,
): Promise<DialogResponse> {
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: pressedCode(transport, tgId, textContains),
    }),
  );
}

/** Нажатие «крафтового» адреса с актуальным штампом экрана. */
function pressRawAddress(
  transport: TestBotTransport,
  tgId: number,
  rawCode: string,
): Promise<DialogResponse> {
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: stampedCode(transport, tgId, rawCode),
    }),
  );
}

/** /start → «Школа» → «Потоки»: каталог потоков открыт. */
async function openStreamsCatalog(
  transport: TestBotTransport,
  tgId: number,
): Promise<DialogResponse> {
  await transport.handleStart(transport.makeBotContext(tgId));
  await pressByText(transport, tgId, 'Школа');
  return pressByText(transport, tgId, 'Потоки');
}

describe('E2E: Витрина для любопытного', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('e2e-curious');
    const streamController = new StreamsController();
    const courseController = new CoursesController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    const schoolController = new SchoolController();
    const learningController = new LearningController();
    const mentorController = new MentorController();
    transport = createTestBotTransport(app, [
      appController,
      schoolController,
      streamController,
      courseController,
      learningController,
      mentorController,
    ]);
    guest = await app.userByTelegramId(1001);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── «Потоки курсов»: curious-режим карточки потока ──
  describe('«Потоки курсов» — curious-режим карточки потока', () => {
    test('гость → enrollment-поток: карточка без менторских кнопок (S02)', async () => {
      const tgId = guest.user.view().telegramId;
      await transport.handleStart(transport.makeBotContext(tgId));
      await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: pressedCode(transport, tgId, 'Школа'),
        }),
      );
      await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: pressedCode(transport, tgId, 'Потоки'),
        }),
      );
      const response = await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: pressedCode(transport, tgId, 'JS Core — Поток 1'),
        }),
      );
      const text = response.screen?.text ?? '';
      expect(text).toContain('JS Core');
      expect(text).toContain('Ментор');
      expect(text).toContain('📚 Курс');
      expect(text).not.toContain('Неизвестная команда');
      const btns =
        response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
      expect(btns.some((t) => t.includes('Программа модуля'))).toBe(true);
      expect(btns.some((t) => t.includes('Детали'))).toBe(true);
      expect(btns.some((t) => t.includes('Назад к списку'))).toBe(true);
      // Менторские lifecycle-кнопки отсутствуют
      expect(btns.some((t) => t.includes('Запустить'))).toBe(false);
      expect(btns.some((t) => t.includes('Завершить'))).toBe(false);
      expect(btns.some((t) => t.includes('В архив'))).toBe(false);
      // Гостевая кнопка записи (статус enrollment, гость — не студент)
      expect(btns.some((t) => t.includes('Записаться'))).toBe(true);
      // Публичная карточка студентов (Трек 6)
      expect(btns.some((t) => t.includes('Студенты'))).toBe(true);

      // Нажатие на «Студенты» работает (кросс-стори callback)
      const studentsResp = await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: pressedCode(transport, tgId, 'Студенты'),
        }),
      );
      const studentsText = studentsResp.screen?.text ?? '';
      expect(studentsText).not.toContain('Неизвестная команда');
      expect(studentsText).toContain('Студенты потока');
      expect(studentsText).toContain('Всего:');
    });
  });

  // ── «Курсы» — drill-up (обратная навигация) ──
  describe('«Курсы» — обратная навигация', () => {
    test('drill-down 5 уровней → drill-up 4 уровня обратно', async () => {
      const tgId = guest.user.view().telegramId;
      await transport.handleStart(transport.makeBotContext(tgId));
      const press = (label: string) =>
        transport.handleCallback(
          transport.makeBotContext(tgId, {
            callbackData: pressedCode(transport, tgId, label),
          }),
        );

      await press('Курсы');
      await press('Синтаксис');
      await press('JavaScript');
      await press('Введение');
      const l4 = await press('Переменные');
      expect(l4.screen?.text).toContain('Переменные');

      // Назад: 4 → 3
      const back3 = await press('Назад к проекту');
      expect(back3.screen?.text).toContain('Введение');

      // Назад: 3 → 2
      const back2 = await press('Назад к модулю');
      expect(back2.screen?.text).toContain('JavaScript');

      // Назад: 2 → 1
      const back1 = await press('Назад к этапу');
      expect(back1.screen?.text).toContain('Синтаксис');

      // Назад: 1 → 0
      const back0 = await press('Назад к курсу');
      expect(back0.screen?.text).toContain('Основы программирования');

      // Назад: 0 → главное меню
      const menu = await press('Главное меню');
      expect(menu.screen?.text).toContain('Главное меню');
    });
  });

  // ── «Потоки курсов» — отказы ──
  describe('«Потоки курсов» — round-trip навигация', () => {
    test('несуществующий поток — экран ошибки', async () => {
      const tgId = guest.user.view().telegramId;
      await transport.handleStart(transport.makeBotContext(tgId));
      // Крафтовый код с АКТУАЛЬНЫМ штампом экрана: по форме валиден,
      // но поток не существует — экран ошибки, без падений
      const stamp = pressedCode(transport, tgId, 'Курсы').split(':').pop();
      const response = await transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: `stream:view-stream:view:ffffffff-ffff-ffff-ffff-ffffffffffff:${stamp}`,
        }),
      );
      expect(String(response.notify?.text)).toContain('не найден');
    });
  });

  // ── Сквозной: курсы ↔ потоки ──
  describe('Сквозная навигация: курсы ↔ потоки', () => {
    test('главное меню → курсы → назад → потоки → карточка → назад', async () => {
      const tgId = guest.user.view().telegramId;
      await transport.handleStart(transport.makeBotContext(tgId));
      const press = (label: string) =>
        transport.handleCallback(
          transport.makeBotContext(tgId, {
            callbackData: pressedCode(transport, tgId, label),
          }),
        );

      const courses = await press('Курсы');
      expect(courses.screen?.text).toContain('Курсы');

      const main1 = await press('Главное меню');
      expect(main1.screen?.text).toContain('Главное меню');

      // Кнопки меню есть на экране короткого меню — pressedCode их найдёт
      await press('Школа');
      const catalog = await press('Потоки');
      expect(catalog.screen?.text).toContain('Потоки курсов');

      const card = await press('JS Core — Поток 1');
      expect(card.screen?.text).toContain('JS Core');

      const back = await press('Назад к списку');
      expect(back.screen?.text).toContain('Потоки курсов');
    });
  });

  // ── Каталог: переключатели статусов и неизвестное действие ──

  describe('«Потоки курсов» — переключатели статусов', () => {
    const tgId = 1001;

    test('P3-40: «Вкл. завершённые» / «Вкл. архивированные» / «Только активные»', async () => {
      const initial = await openStreamsCatalog(transport, tgId);
      const initialButtons = buttonsOfResponse(initial);
      expect(initialButtons).toContainEqual(
        expect.stringContaining('Вкл. завершённые'),
      );
      expect(initialButtons).toContainEqual(
        expect.stringContaining('Вкл. архивированные'),
      );
      expect(initialButtons.some((t) => t.includes('Поток 3'))).toBe(false);
      expect(initialButtons.some((t) => t.includes('Поток 4'))).toBe(false);

      const withCompleted = await pressByText(
        transport,
        tgId,
        'Вкл. завершённые',
      );
      expect(buttonsOfResponse(withCompleted)).toContainEqual(
        expect.stringContaining('Поток 3'),
      );
      expect(buttonsOfResponse(withCompleted)).toContainEqual(
        expect.stringContaining('Вкл. архивированные'),
      );

      const withAll = await pressByText(transport, tgId, 'Вкл. архивированные');
      expect(buttonsOfResponse(withAll)).toContainEqual(
        expect.stringContaining('Поток 4'),
      );
      expect(buttonsOfResponse(withAll)).toContainEqual(
        expect.stringContaining('Только активные'),
      );

      const activeOnly = await pressByText(transport, tgId, 'Только активные');
      const activeButtons = buttonsOfResponse(activeOnly);
      expect(activeButtons.some((t) => t.includes('Поток 3'))).toBe(false);
      expect(activeButtons.some((t) => t.includes('Поток 4'))).toBe(false);
      expect(activeButtons).toContainEqual(
        expect.stringContaining('Вкл. завершённые'),
      );
    });

    test('F-43: группы каталога идут в порядке набор → идёт → завершён → архив', async () => {
      await openStreamsCatalog(transport, tgId);
      await pressByText(transport, tgId, 'Вкл. завершённые');
      const all = await pressByText(transport, tgId, 'Вкл. архивированные');

      const jsCore = buttonsOfResponse(all).filter((t) =>
        t.includes('JS Core — Поток'),
      );
      expect(jsCore.map((t) => t.match(/Поток (\d)/)?.[1])).toEqual([
        '1',
        '5',
        '2',
        '3',
        '4',
      ]);
    });

    test('P3-43: неизвестное действие каталога — «Неизвестная команда»', async () => {
      await openStreamsCatalog(transport, tgId);
      const response = await pressRawAddress(
        transport,
        tgId,
        'stream:catalog:bogus',
      );

      expect(textOfResponse(response)).toContain('Неизвестная команда');
    });
  });

  // ── Карточка потока: отзывы, программа, студенты, владение ──

  describe('«Потоки курсов» — карточка, программа и студенты', () => {
    const tgId = 1001;
    const enrollmentStream = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
    const unknownId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const guestStep = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';

    test('P3-45: карточка потока без отзывов — кнопки «Отзывы» нет, карточка жива', async () => {
      await openStreamsCatalog(transport, tgId);
      const card = await pressByText(transport, tgId, 'JS Core — Поток 1');

      const text = textOfResponse(card);
      expect(text).toContain('JS Core');
      expect(text).not.toContain('Неизвестная команда');
      const buttons = buttonsOfResponse(card);
      expect(buttons.some((t) => t.includes('Отзывы'))).toBe(false);
      expect(buttons).toContainEqual(
        expect.stringContaining('Программа модуля'),
      );
    });

    test('P3-48: программа потока на уровне «step» — тела шагов недоступны', async () => {
      await openStreamsCatalog(transport, tgId);
      const response = await pressRawAddress(
        transport,
        tgId,
        `stream:view-stream:program:${enrollmentStream}:step:${guestStep}`,
      );

      expect(textOfResponse(response)).toContain(
        'Тела шагов недоступны для просмотра',
      );
    });

    test('P3-49: программа — несуществующий уровень и несуществующий поток', async () => {
      await openStreamsCatalog(transport, tgId);
      const unknownLevel = await pressRawAddress(
        transport,
        tgId,
        `stream:view-stream:program:${enrollmentStream}:lesson:${unknownId}`,
      );
      expect(textOfResponse(unknownLevel)).toContain(
        'Уровень программы не найден',
      );

      // После ответа без экрана штамп устарел: переоткрываем каталог
      await openStreamsCatalog(transport, tgId);
      const unknownStream = await pressRawAddress(
        transport,
        tgId,
        `stream:view-stream:program:${unknownId}`,
      );
      expect(String(unknownStream.notify?.text)).toContain('Поток не найден');
    });

    test('P3-50: «📋 Детали» — заполненные поля и возврат к потоку', async () => {
      await openStreamsCatalog(transport, tgId);
      await pressByText(transport, tgId, 'JS Core — Поток 1');
      const details = await pressByText(transport, tgId, 'Детали');

      const text = textOfResponse(details);
      expect(text).toContain('Детали');
      expect(text).toContain('Цель');
      expect(text).toContain('Результат');
      expect(buttonsOfResponse(details)).toContainEqual(
        expect.stringContaining('Назад к потоку'),
      );
    });

    test('P3-53: «Студенты» → студент — публичная карточка без менторских действий', async () => {
      await openStreamsCatalog(transport, tgId);
      await pressByText(transport, tgId, 'JS Core — Поток 2');
      const list = await pressByText(transport, tgId, 'Студенты');
      expect(textOfResponse(list)).toContain('Студенты потока');

      const card = await pressByText(transport, tgId, 'Марина');
      const text = textOfResponse(card);
      expect(text).toContain('Прогресс студента');
      expect(text).toContain('Усидчивость студента');
      expect(text).toContain('Активность студента');
      const buttons = buttonsOfResponse(card);
      expect(buttons).toContainEqual(expect.stringContaining('Назад к списку'));
      expect(buttons.some((t) => t.includes('Снять'))).toBe(false);
      expect(buttons.some((t) => t.includes('Отметить'))).toBe(false);
    });

    test('P3-64: «📝 Записаться» — только не-владельцу и только в статусе набора', async () => {
      // Владелец потока (ментор) записи не видит
      await openStreamsCatalog(transport, 1004);
      const ownerCard = await pressByText(transport, 1004, 'JS Core — Поток 1');
      expect(
        buttonsOfResponse(ownerCard).some((t) => t.includes('Записаться')),
      ).toBe(false);

      // Ментор-зритель (не владелец потока) видит гостевую кнопку записи
      await openStreamsCatalog(transport, 1009);
      const viewerCard = await pressByText(
        transport,
        1009,
        'JS Core — Поток 1',
      );
      expect(
        buttonsOfResponse(viewerCard).some((t) => t.includes('Записаться')),
      ).toBe(true);

      // Не в наборе — записи нет ни у зрителя, ни у гостя
      await pressByText(transport, 1009, 'Назад к списку');
      await pressByText(transport, 1009, 'Вкл. завершённые');
      const completedCard = await pressByText(
        transport,
        1009,
        'JS Core — Поток 3',
      );
      expect(
        buttonsOfResponse(completedCard).some((t) => t.includes('Записаться')),
      ).toBe(false);
    });
  });
});

/** Мир только с завершёнными и архивными потоками (нет видимых). */
const WORLD_ONLY_FINISHED: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'curious-only-finished',
  description: 'Завершённый и архивный потоки без активных',
  streams: (CORE_EDUCATION_WORLD.streams ?? []).filter(
    (s) => s.status === 'completed' || s.status === 'archived',
  ),
  students: (CORE_EDUCATION_WORLD.students ?? []).filter(
    (s) => s.streamKey === 'stream-1-completed',
  ),
  campaigns: (CORE_EDUCATION_WORLD.campaigns ?? []).filter(
    (c) => c.key === 'camp-s1-dmitry',
  ),
  reviews: (CORE_EDUCATION_WORLD.reviews ?? []).filter(
    (r) => r.campaignKey === 'camp-s1-dmitry',
  ),
};

describe('E2E: Витрина — только завершённые потоки', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('curious-only-finished', WORLD_ONLY_FINISHED);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P3-41: каталог без видимых потоков — «Нет активных потоков», переключатели и выход', async () => {
    const list = await openStreamsCatalog(transport, 1001);

    expect(textOfResponse(list)).toContain('Нет активных потоков');
    const buttons = buttonsOfResponse(list);
    expect(buttons).toContainEqual(expect.stringContaining('Вкл. завершённые'));
    expect(buttons).toContainEqual(
      expect.stringContaining('Вкл. архивированные'),
    );
    expect(buttons).toContainEqual(expect.stringContaining('Назад в школу'));

    const withCompleted = await pressByText(
      transport,
      1001,
      'Вкл. завершённые',
    );
    expect(buttonsOfResponse(withCompleted)).toContainEqual(
      expect.stringContaining('Поток 3'),
    );
  });
});

/** Мир без потоков вообще: каталог пуст. */
const WORLD_WITHOUT_STREAMS: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'curious-no-streams',
  description: 'Курсы есть, потоков нет',
  streams: [],
  students: [],
  campaigns: [],
  reviews: [],
};

describe('E2E: Витрина — потоков нет совсем', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('curious-no-streams', WORLD_WITHOUT_STREAMS);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P3-42: каталог без потоков — «Нет доступных потоков» и выход в школу', async () => {
    const list = await openStreamsCatalog(transport, 1001);

    const text = textOfResponse(list);
    expect(text).toContain('Нет доступных потоков');
    expect(buttonsOfResponse(list)).toContainEqual(
      expect.stringContaining('Назад в школу'),
    );
  });
});

const EMPTY_PROGRAM_COURSE = 'b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9';
const EMPTY_PROGRAM_MODULE = 'a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9';
const EMPTY_PROGRAM_STREAM = 'e9e9e9e9-e9e9-4e9e-8e9e-e9e9e9e9e9e9';
/** Студент, чей поток в мире отсутствует (карточка без прогресса). */
const GHOST_STUDENT = 'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9';

/**
 * Мир с потоком без программы и без заполненных деталей + студент без потока:
 * пустые ветки программы/деталей и отказ карточки студента.
 */
const WORLD_EMPTY_PROGRAM: WorldDefinition = {
  name: 'curious-empty-program',
  description: 'Поток с пустым снапшотом и незаполненными деталями',
  anchorDate: CORE_EDUCATION_ANCHOR,
  persons: [
    {
      key: 'guest',
      uuid: '11111111-1111-1111-1111-111111111111',
      name: 'Гость',
      telegramId: 1001,
      roles: [Role.GUEST],
      registeredAt: 'T-90d',
    },
    {
      key: 'dev',
      uuid: '44444444-4444-4444-4444-444444444444',
      name: 'Алексей',
      telegramId: 1004,
      roles: [Role.MENTOR, Role.AUTHOR],
      registeredAt: 'T-90d',
    },
  ],
  courses: [
    {
      key: 'course-empty',
      uuid: EMPTY_PROGRAM_COURSE,
      title: 'Курс без проектов',
      description: 'Курс с модулем без проектов: пустой снапшот потока.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-empty',
          uuid: EMPTY_PROGRAM_MODULE,
          title: 'Пустой модуль',
        },
      ],
    },
  ],
  streams: [
    {
      key: 'stream-empty',
      uuid: EMPTY_PROGRAM_STREAM,
      title: 'Поток без программы',
      description: 'Поток с пустым снапшотом и незаполненными деталями.',
      courseKey: 'course-empty',
      moduleKey: 'mod-empty',
      mentorKey: 'dev',
      status: 'enrollment',
      startedAt: 'T+10d',
      goal: '',
      result: '',
    },
  ],
  students: [
    {
      key: 'student-ghost',
      uuid: GHOST_STUDENT,
      personKey: 'guest',
      streamKey: 'ghost-stream',
      enrolledAt: 'T-1d',
      status: 'active',
      steps: [],
    },
  ],
};

describe('E2E: Витрина — пустая программа и пропавший поток', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  const tgId = 1001;
  const unknownId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  beforeAll(async () => {
    app = await createTestApp('curious-empty-program', WORLD_EMPTY_PROGRAM);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P3-47: программа потока с пустым снапшотом — «Программа пока не загружена»', async () => {
    await openStreamsCatalog(transport, tgId);
    await pressByText(transport, tgId, 'Поток без программы');
    const program = await pressByText(transport, tgId, 'Программа модуля');

    expect(textOfResponse(program)).toContain('Программа пока не загружена');
    expect(buttonsOfResponse(program)).toContainEqual(
      expect.stringContaining('Назад к потоку'),
    );
  });

  test('P3-51: «Детали» без единого заполненного поля — «Расширенная информация пока не добавлена»', async () => {
    await openStreamsCatalog(transport, tgId);
    await pressByText(transport, tgId, 'Поток без программы');
    const details = await pressByText(transport, tgId, 'Детали');

    expect(textOfResponse(details)).toContain(
      'Расширенная информация пока не добавлена',
    );
    expect(buttonsOfResponse(details)).toContainEqual(
      expect.stringContaining('Назад к потоку'),
    );
  });

  test('P3-54: «Студенты»/карточка студента, поток не найден — «⚠️ Поток не найден»', async () => {
    await openStreamsCatalog(transport, tgId);
    const list = await pressRawAddress(
      transport,
      tgId,
      `stream:view-stream:students:${unknownId}`,
    );
    expect(String(list.notify?.text)).toContain('Поток не найден');

    // После ответа без экрана штамп устарел: переоткрываем каталог
    await openStreamsCatalog(transport, tgId);
    const card = await pressRawAddress(
      transport,
      tgId,
      `stream:view-stream:student-detail:${GHOST_STUDENT}`,
    );
    expect(String(card.notify?.text)).toContain('Поток не найден');
  });
});
