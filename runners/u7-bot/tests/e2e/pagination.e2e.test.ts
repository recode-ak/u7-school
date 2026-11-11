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
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
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
 * E2E: Пагинация длинного контента (трек pagination, ФР-7).
 *
 * Листание — edit на месте (messageId исходного экрана не меняется, новых
 * сообщений не приходит), каждый ответ — assertDialogResponseMarkdownSafe.
 *
 * Сценарии:
 * - S03 «Программа курса»: поток «JS Core — Длинная программа» (24 проекта —
 *   фикстура e6e6…) — drill-down по проектам.
 * - Каталог, уровень 3 «Модуль»: курс «Длинный курс (пагинация)» →
 *   модуль «Длинный модуль (пагинация)» (16 проектов × 4 урока — фикстуры
 *   f1f1…/f2f2…) — сквозной проход проектов вперёд до последнего и назад.
 */
describe('E2E: Пагинация (S03 + каталог уровня 3)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: User;

  beforeAll(async () => {
    app = await createTestApp('e2e-pagination');
    const controllers = [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
      new CoursesController(),
      new LearningController(),
      new MentorController(),
    ];
    transport = createTestBotTransport(app, controllers);
    guest = (await app.userFacade.getUserByTelegramId(1001))!;
  });

  beforeEach(() => {
    transport.reset();
    transport.dropSession(guest.telegramId);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Внутренние хелперы ──

  /** Экраны пользователя от новых к старым (см. curious-showcase e2e). */
  function screensNewFirst(tgId: number): ScreenRecord[] {
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

  /** Отштампованный код кнопки с последнего экрана пользователя. */
  function pressedCode(tgId: number, label: string): string {
    for (const screen of screensNewFirst(tgId)) {
      const btn = screen.keyboard?.rows
        .flat()
        .find((b) => b.text.includes(label));
      if (btn) return btn.code;
    }
    throw new Error(`Кнопка «${label}» не найдена на экранах ${tgId}`);
  }

  /** Есть ли кнопка с меткой на последнем экране. */
  function hasButton(tgId: number, label: string): boolean {
    const screen = screensNewFirst(tgId)[0];
    return (
      screen?.keyboard?.rows.flat().some((b) => b.text.includes(label)) ?? false
    );
  }

  /** Нажать кнопку по метке; ответ ассертится на валидность MarkdownV2. */
  async function press(tgId: number, label: string) {
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(tgId, label),
      }),
    );
    assertDialogResponseMarkdownSafe(response);
    return response;
  }

  /**
   * Собирает номера проектов со страницы: дубль — ошибка (проект разорван
   * между страницами или продублирован).
   */
  function collectProjects(text: string, seen: Set<string>): void {
    for (const m of text.matchAll(/Проект (\d+):/g)) {
      const num = m[1];
      if (!num) continue;
      expect(seen.has(num)).toBe(false);
      seen.add(num);
    }
  }

  /** messageId последнего sent-сообщения пользователя (исходный экран). */
  function lastSentMessageId(tgId: number): number {
    const sent = transport.api.sentMessages.filter(
      (s) => s.telegramId === tgId,
    );
    if (sent.length === 0) throw new Error('нет sent-сообщений');
    return sent[sent.length - 1]!.messageId;
  }

  /** Последний edit — на месте: тот же messageId, новых sent не пришло. */
  function expectEditInPlace(tgId: number, originMessageId: number): void {
    const edits = transport.api.editedMessages.filter(
      (e) => e.telegramId === tgId,
    );
    expect(edits.length).toBeGreaterThan(0);
    expect(edits[edits.length - 1]!.messageId).toBe(originMessageId);
    // новых сообщений не приходило: каждый sent либо исходный, либо старт
    const sentIds = transport.api.sentMessages
      .filter((s) => s.telegramId === tgId)
      .map((s) => s.messageId);
    expect(new Set(sentIds).size).toBe(sentIds.length);
  }

  // ── S03: программа длинного потока (drill-down) ──

  test('S03: длинная программа — drill-down навигация по проектам', async () => {
    const tgId = guest.telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    await press(tgId, 'Школа');
    await press(tgId, 'Потоки');
    const card = await press(tgId, 'JS Core — Длинная программа');
    expect(card.screen?.text).toContain('Длинная программа');

    const program = await press(tgId, 'Программа модуля');
    const programText = String(program.screen?.text ?? '');
    expect(programText).toContain('Программа модуля');
    expect(programText).toContain('Проект 01');

    // Переход в проект 01 через кнопку
    const projectScreen = await press(tgId, 'Проект 01');
    const projectText = String(projectScreen.screen?.text ?? '');
    expect(projectText).toContain('Проект 01');
    expect(hasButton(tgId, 'След. проект ▶️')).toBe(true);

    // Листание проектов
    const nextProject = await press(tgId, 'След. проект ▶️');
    expect(String(nextProject.screen?.text ?? '')).toContain('Проект 02');

    // Возврат к модулю
    const backToRoot = await press(tgId, 'Назад к модулю');
    expect(String(backToRoot.screen?.text ?? '')).toContain('Программа модуля');
  });

  // ── Каталог: уровень 3 длинного модуля (drill-down) ──

  /**
   * Открывает карточку курса «Длинный курс (пагинация)». У курса один этап,
   * поэтому модули этапа видны сразу на карточке курса: шага «нажать
   * этап» нет, признак целевой карточки — кнопка её модуля.
   */
  async function openLongCourse(tgId: number): Promise<void> {
    await transport.handleStart(transport.makeBotContext(tgId));
    await press(tgId, 'Курсы');
    while (true) {
      const screens = screensNewFirst(tgId);
      const isTarget = screens[0]?.keyboard?.rows
        .flat()
        .some((b) => b.text.includes('Длинный модуль'));
      if (isTarget) break;
      const nextBtn = screens[0]?.keyboard?.rows
        .flat()
        .find((b) => b.text.includes('След. курс'));
      if (!nextBtn) break;
      await transport.handleCallback(
        transport.makeBotContext(tgId, { callbackData: nextBtn.code }),
      );
    }
  }

  test('Каталог: длинный модуль — сквозной проход проектов до последнего и обратно', async () => {
    const tgId = guest.telegramId;
    await openLongCourse(tgId);

    const modulesScreen = await press(tgId, 'Длинный модуль');
    const modulesText = String(modulesScreen.screen?.text ?? '');
    expect(modulesText).toContain('Длинный модуль');
    expect(modulesText).toContain('Проект 01');

    // Состав уровня «Модуль»: каждый проект модуля — один раз
    const moduleProjects = new Set<string>();
    collectProjects(modulesText, moduleProjects);
    expect(moduleProjects.size).toBeGreaterThanOrEqual(10);

    const originMessageId = lastSentMessageId(tgId);

    // Вперёд: от первого проекта до последнего, edit на месте на каждом шаге
    let screen = await press(tgId, 'Проект 01');
    const visited = new Set<string>();
    collectProjects(String(screen.screen?.text ?? ''), visited);
    expect(hasButton(tgId, '◀️ Пред. проект')).toBe(false);
    expectEditInPlace(tgId, originMessageId);

    let steps = 0;
    while (hasButton(tgId, 'След. проект ▶️')) {
      screen = await press(tgId, 'След. проект ▶️');
      collectProjects(String(screen.screen?.text ?? ''), visited);
      expectEditInPlace(tgId, originMessageId);
      steps += 1;
      if (steps > moduleProjects.size)
        throw new Error('листание не завершилось');
    }
    expect(hasButton(tgId, '◀️ Пред. проект')).toBe(true);

    // Каждый проект модуля пройден ровно один раз: без дублей и разрывов
    expect(visited).toEqual(moduleProjects);

    // Назад до первого проекта
    let backSteps = 0;
    while (hasButton(tgId, '◀️ Пред. проект')) {
      screen = await press(tgId, '◀️ Пред. проект');
      expectEditInPlace(tgId, originMessageId);
      backSteps += 1;
      if (backSteps > moduleProjects.size) {
        throw new Error('обратное листание не завершилось');
      }
    }
    expect(backSteps).toBe(steps);
    expect(String(screen.screen?.text ?? '')).toContain('Проект 01');

    // Возврат к модулю
    const backToModule = await press(tgId, 'Назад к модулю');
    expect(String(backToModule.screen?.text ?? '')).toContain('Длинный модуль');
    expectEditInPlace(tgId, originMessageId);
  });
});
