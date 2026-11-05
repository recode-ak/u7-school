import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import {
  CreateStreamUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';

/**
 * Интеграционный тест S02: карточка потока и навигация вокруг неё.
 *
 * Контракт «Диалог и Экран»: ассерты — по DialogResponse, захваченному
 * на границе uiApp. Коды прямых вызовов штампуются актуальным штампом
 * открытого экрана; нажатия по кнопкам с экрана — pressedCode.
 * Сжатие UUID и штампы проверяются по Api-записи («что увидел Telegram»).
 *
 * Фикстурные ID:
 *   e0e0e0e0 — enrollment (🟡 JS Core, есть contentSnapshot)
 *   e1e1e1e1 — active     (🔵 JS Core 2, есть contentSnapshot)
 */
describe('ViewStreamStory (интеграционный)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: User;
  let mentor: User;

  const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
  const ENROLLMENT_ID = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
  const ACTIVE_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';

  beforeAll(async () => {
    app = await createTestApp('streams-view-int');
    const streamController = new StreamsController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    const schoolController = new SchoolController();
    transport = createTestBotTransport(app, [
      appController,
      schoolController,
      streamController,
    ]);
    guest = (await app.userFacade.getUserByTelegramId(1001))!;
    mentor = (await app.userFacade.getUserByTelegramId(1004))!;
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Открывает диалог и вызывает сырой код view-stream с актуальным штампом. */
  async function openView(
    user: User,
    action: 'view' | 'program' | 'details' | 'students',
    streamId: string,
  ) {
    await transport.handleStart(transport.makeBotContext(user.telegramId));
    return transport.handleCallback(
      transport.makeBotContext(user.telegramId, {
        callbackData: stampedCode(
          transport,
          user.telegramId,
          `stream:view-stream:${action}:${streamId}`,
        ),
      }),
    );
  }

  // ── S02: Карточка потока ──

  test('view: нет менторских lifecycle-кнопок (гость)', async () => {
    const response = await openView(guest, 'view', ENROLLMENT_ID);
    const btns =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btns.some((t) => t.includes('Запустить'))).toBe(false);
    expect(btns.some((t) => t.includes('Завершить'))).toBe(false);
    expect(btns.some((t) => t.includes('В архив'))).toBe(false);
  });

  test('view: несуществующий поток — ошибка', async () => {
    const response = await openView(
      guest,
      'view',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    );
    expect(String(response.notify?.text)).toContain('не найден');
  });

  test('сквозной: каталог → карточка → программа → назад', async () => {
    const tgId = guest.telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const press = (label: string) =>
      transport.handleCallback(
        transport.makeBotContext(tgId, {
          callbackData: pressedCode(transport, tgId, label),
        }),
      );

    // 1. Каталог потоков
    await press('Школа');
    const catalogResp = await press('Потоки');
    expect(catalogResp.screen?.text).toContain('Потоки курсов');

    // 2-3. Enrollment-поток (🟡) → карточка
    const viewResp = await press('JS Core — Поток 1');
    expect(viewResp.screen?.text).toContain('JS Core');

    // 4-5. «Программа модуля» → программа
    const programResp = await press('Программа модуля');
    expect(programResp.screen?.text).toContain('Программа модуля');

    // 6-7. «Назад к потоку» → карточка
    const backResp = await press('Назад к потоку');
    expect(backResp.screen?.text).toContain('JS Core');
  });

  test('сжатие UUID: кнопка потока сжимается и приходит обратно разжатой', async () => {
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

    // 1. Что ушло в Telegram: полный UUID не должен попасть в callback_data
    //    (Api-запись последнего экрана каталога)
    // (последняя Api-запись каталога С клавиатурой: retire-эдит клавиатуру
    // уже снял — текст тот же, кнопок нет)
    const catalogScreen = [...transport.api.editedMessages]
      .reverse()
      .concat([...transport.api.sentMessages].reverse())
      .filter((m) => m.telegramId === tgId)
      .find((m) => m.text.includes('Потоки курсов') && m.keyboard);
    expect(catalogScreen).toBeDefined();
    const streamBtn = catalogScreen?.keyboard?.rows
      .flat()
      .find((b) => b.text.includes('JS Core — Поток 1'));
    expect(streamBtn).toBeDefined();
    expect(streamBtn!.code).not.toContain(ENROLLMENT_ID);
    expect(
      new TextEncoder().encode(streamBtn!.code).length,
    ).toBeLessThanOrEqual(64);

    // 2. Нажатие отштампованной сжатой кнопки возвращает полную карточку —
    //    разжатие UUID сработало
    const viewResp = await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: streamBtn!.code }),
    );
    expect(viewResp.screen?.text).toContain('JS Core');
  });

  // ── S05: Список студентов (публичный) ──

  test('students: открывает список студентов с метриками', async () => {
    const response = await openView(guest, 'students', ACTIVE_ID);
    const text = response.screen?.text ?? '';
    expect(text).toContain('Студенты потока');
    expect(text).toContain('Метрики группы');
    expect(text).not.toContain('Неизвестная команда');
  });

  test('enroll-key: гость вводит кодовое слово и записывается', async () => {
    const ENROLL_KEY_ID = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4';

    // 1. Карточка потока с кодовым словом (Поток 5)
    const viewResp = await openView(guest, 'view', ENROLL_KEY_ID);
    expect(viewResp.screen?.text).toContain('Поток 5');

    // 2-3. «Записаться» → бот запрашивает кодовое слово (awaitInput)
    const tgId = guest.telegramId;
    const enrollResp = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Записаться'),
      }),
    );
    expect(enrollResp.screen?.text).toContain('кодовое слово');
    expect(enrollResp.awaitInput).toBeDefined();

    // 4. Верное кодовое слово — зачисление (notify-реплика + delegate в меню)
    const keyResp = await transport.handleMessage(
      transport.makeBotContext(tgId, { text: 'secret123' }),
    );
    const keyText = keyResp.notify?.text ?? '';
    expect(keyText).toContain('записаны');

    // Реплика содержит инструкцию по /start и кнопке «Моя учёба»
    expect(keyText).toContain('Теперь вы можете получить функционал по учёбе');

    // Без дубля: хаб не подписан на student.enrolled —
    // гостю не приходит отдельное «Ты зачислен…» поверх флоу-ответа
    const duplicates = transport.api.sentMessages.filter(
      (m) => m.telegramId === tgId && m.text.includes('зачислен'),
    );
    expect(duplicates).toHaveLength(0);
  });

  // ── Допуск к модулю (PREREQUISITE_NOT_PASSED) ──

  test('запись на модуль без пройденного предыдущего → «Сначала пройдите модуль «…»»', async () => {
    // Алгоритмика — последняя фаза; кандидат 1002 предыдущий модуль не проходил
    const stream = expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CreateStreamUcDef.command({
          title: 'Алгоритмика — закрытый допуск',
          description: 'Поток для проверки допуска',
          moduleId: 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
          startDate: Date.UTC(2026, 10, 1),
        }),
        new UserCaller(mentor),
        Trace.fromRequest({ requestId: crypto.randomUUID() }),
      ),
    );

    const candidate = (await app.userFacade.getUserByTelegramId(1002))!;
    await openView(candidate, 'view', stream.streamId);
    const tgId = candidate.telegramId;
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Записаться'),
      }),
    );

    const text = (response.notify?.text ??
      response.screen?.text ??
      '') as string;
    expect(text).toMatch(/Сначала пройдите модуль «.+»/);
    expect(text).not.toContain('записаны');
  });
});
