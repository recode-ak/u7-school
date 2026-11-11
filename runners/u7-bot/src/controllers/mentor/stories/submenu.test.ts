import { describe, expect, test } from 'bun:test';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { SubmenuStory } from './submenu';

// Доступ к подменю решают роли актора: актор бота — `UserCaller` над `UserAr`
// (`actor.user.isMentor()`/`isAdmin()`), резолвер `Caller` не нужен.

function actor(uuid: string, roles: UserView['roles']) {
  return userActor({ uuid, name: 'Тест', telegramId: 123, roles });
}

const mentor = actor('11111111-1111-4111-8111-111111111111', ['MENTOR']);
const admin = actor('22222222-2222-4222-8222-222222222222', ['ADMIN']);
const guestRole = actor('33333333-3333-4333-8333-333333333333', ['GUEST']);
const subscriber = actor('44444444-4444-4444-8444-444444444444', [
  'SUBSCRIBER',
]);
const session: BotSession = {
  dialog: { path: 'mentor/submenu', seq: 2 },
};

function createStory(): SubmenuStory {
  const story = new SubmenuStory();
  story.init({} as never);
  return story;
}

describe('SubmenuStory (S02m) — контракт «Диалог и Экран»', () => {
  // ── menuButtons: вход в подменю из главного меню ──

  test('menuButtons: MENTOR — кнопка «🛠️ Инструменты ментора» (priority 30)', async () => {
    const story = createStory();
    const buttons = await story.menuButtons(mentor);
    expect(buttons).toHaveLength(1);
    const btn = buttons[0]!;
    expect(btn.kind).toBe('callback');
    expect(btn.text).toBe('🛠️ Инструменты ментора');
    expect(btn.priority).toBe(30);
    if (btn.kind === 'callback') {
      expect(btn.action).toBe('submenu:start');
      expect(btn.description).toContain('Инструменты ментора');
    }
  });

  test('menuButtons: ADMIN видит кнопку', async () => {
    const story = createStory();
    expect(await story.menuButtons(admin)).toHaveLength(1);
  });

  test('menuButtons: GUEST — нет кнопки', async () => {
    const story = createStory();
    expect(await story.menuButtons(guestRole)).toEqual([]);
  });

  test('menuButtons: SUBSCRIBER — нет кнопки', async () => {
    const story = createStory();
    expect(await story.menuButtons(subscriber)).toEqual([]);
  });

  // ── handleCallback "start": экран подменю с точной клавиатурой ──

  test('start: экран «Инструменты ментора» с тремя кнопками', async () => {
    const story = createStory();
    const response: DialogResponse = await story.handleCallback(
      'start',
      mentor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Инструменты ментора');
    const rows = response.screen?.keyboard?.rows ?? [];
    expect(rows).toHaveLength(3);
    // Точные кнопки и коды (инвентаризация S02m)
    expect(rows[0]).toEqual([
      { text: '📋 Мои потоки', code: 'my-streams:list' },
    ]);
    expect(rows[1]).toEqual([
      { text: '➕ Создать поток', code: 'create-stream:start' },
    ]);
    expect(rows[2]).toEqual([{ text: '🔙 Назад', code: 'app:main-menu' }]);
    // Экран диалога, не реплика
    expect(response.notify).toBeUndefined();
  });

  test('start: ADMIN — экран подменю', async () => {
    const story = createStory();
    const response = await story.handleCallback('start', admin, session);
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('Инструменты ментора');
    expect(response.screen?.keyboard?.rows ?? []).toHaveLength(3);
  });

  test.each([
    ['GUEST', guestRole],
    ['SUBSCRIBER', subscriber],
  ])('start: %s — экран «нет доступа»', async (_, who) => {
    const story = createStory();
    const response = await story.handleCallback('start', who, session);
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('нет доступа');
    expect(response.screen?.keyboard).toBeUndefined();
  });
});
