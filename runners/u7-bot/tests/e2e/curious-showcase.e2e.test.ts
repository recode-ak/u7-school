import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';

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

describe('E2E: Витрина для любопытного', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: User;

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
    guest = (await app.userFacade.getUserByTelegramId(1001))!;
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
      const tgId = guest.telegramId;
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
      const tgId = guest.telegramId;
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
      const tgId = guest.telegramId;
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
      const tgId = guest.telegramId;
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
});
