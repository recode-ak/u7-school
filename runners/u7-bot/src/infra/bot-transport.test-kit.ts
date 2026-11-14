import { mock } from 'bun:test';
import { mdRaw } from '@u7-scl/core/shared';
import type { BotContext } from '../context';
import type { DialogUiAppPort } from './bot-transport';

/** Мок uiApp-порта транспорта: по умолчанию handle* отвечают простым экраном. */
export function makeUiApp(
  overrides: Partial<DialogUiAppPort> = {},
): DialogUiAppPort {
  return {
    handleCommand: mock(async () => null),
    handleCallback: mock(async () => ({ screen: { text: mdRaw('Ок') } })),
    handleMessage: mock(async () => ({ screen: { text: mdRaw('Принято') } })),
    ...overrides,
  } as unknown as DialogUiAppPort;
}

/** Мок Grammy-контекста приватного чата (tg 123) с колбэком и текстом. */
export function makeCtx(overrides: Partial<BotContext> = {}): BotContext {
  return {
    from: { id: 123, first_name: 'Test', is_bot: false } as BotContext['from'],
    chat: { id: 123, type: 'private' } as BotContext['chat'],
    reply: mock(async () => ({ message_id: 99 })),
    answerCallbackQuery: mock(async () => true),
    callbackQuery: {
      data: 'app:menu:open',
    } as BotContext['callbackQuery'],
    message: { text: 'hello' } as BotContext['message'],
    update: { update_id: 1 } as BotContext['update'],
    ...overrides,
  } as unknown as BotContext;
}

/** Клавиатура одной кнопки. */
export function kb(code: string, text = 'Кнопка') {
  return { rows: [[{ text, code }]], isMultiple: false };
}
