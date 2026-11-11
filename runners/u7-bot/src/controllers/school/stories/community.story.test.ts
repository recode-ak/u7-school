import { describe, expect, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { CommunityStory } from './community.story';

describe('CommunityStory (school)', () => {
  const actor = userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaaaaa2',
    name: 'Гость',
    telegramId: 123,
    roles: ['GUEST'],
  });

  test('имя стори — community, menuButtons пуст для всех ролей (кнопка убрана из главного меню)', async () => {
    const story = new CommunityStory();
    expect(story.name).toBe('community');

    const roles: UserView['roles'] = ['GUEST', 'SUBSCRIBER', 'MENTOR', 'ADMIN'];
    for (const [i, role] of roles.entries()) {
      const user = userActor({
        uuid: `11111111-1111-4111-8111-00000000000${i}`,
        name: role,
        telegramId: 100,
        roles: [role],
      });
      const buttons = await story.menuButtons(user);
      expect(buttons).toEqual([]);
    }
  });

  test('groupUrl берёт URL сообщества из school в resolve при пустом конструкторе', () => {
    const story = new CommunityStory();
    story.init({
      school: {
        ...TEST_SCHOOL,
        communityGroup: {
          id: -100555,
          url: 'https://t.me/from_school_resolve',
        },
      },
    } as any);

    expect(story.groupUrl).toBe('https://t.me/from_school_resolve');
  });

  test('groupUrl берёт URL из конструктора, если он задан', () => {
    const story = new CommunityStory('https://t.me/custom_group');
    expect(story.groupUrl).toBe('https://t.me/custom_group');
  });

  test('handleCallback возвращает неизвестную команду', async () => {
    const story = new CommunityStory();
    const response = await story.handleCallback('any', actor, {
      dialog: { path: 'school/community', seq: 1 },
    });
    expect(String(response.screen?.text)).toContain('Неизвестная команда');
  });

  test('handleMessage возвращает экран с предупреждением', async () => {
    const story = new CommunityStory();
    const response = await story.handleMessage(
      { type: 'message', text: 'что-то', telegramId: 123 },
      actor,
      { dialog: { path: 'school/community', seq: 1 } },
    );
    expect(String(response?.screen?.text)).toContain('Неизвестное сообщение');
  });
});
