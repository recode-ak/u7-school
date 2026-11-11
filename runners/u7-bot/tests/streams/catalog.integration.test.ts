import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';

/**
 * Интеграционный тест S01: витрина потоков (CatalogStory).
 *
 * Контракт «Диалог и Экран»: ассерты — по DialogResponse, захваченному
 * на границе uiApp; нажатия — кодами кнопок отправленного экрана
 * (`pressedCode`), транспорт валидирует штампы на входе.
 *
 * Фикстурные потоки:
 *   e0e0e0e0 — enrollment (🟡 JS Core)
 *   e1e1e1e1 — active     (🔵 JS Core 2)
 *   e2e2e2e2 — completed  (🟢 JS Core 3)
 *   e3e3e3e3 — archived   (⚫ JS Core 4)
 */
describe('CatalogStory (интеграционный)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

  beforeAll(async () => {
    app = await createTestApp('streams-catalog-int');
    const streamController = new StreamsController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    const schoolController = new SchoolController();
    transport = createTestBotTransport(app, [
      appController,
      streamController,
      schoolController,
    ]);
    guest = await app.userByTelegramId(1001);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('переключатель «Вкл. завершённые» работает кнопкой с экрана', async () => {
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
        callbackData: pressedCode(transport, tgId, 'Вкл. завершённые'),
      }),
    );
    const btns =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btns.some((t) => t.includes('Поток 3'))).toBe(true);
  });
});
