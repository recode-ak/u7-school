import { describe, expect, mock, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { setGlobalLogger } from '@u7-scl/core/shared';
import type { BotSession } from '@u7-scl/core/ui';
import {
  assertDialogResponseMarkdownSafe,
  BotRequestContext,
} from '@u7-scl/core/ui';
import {
  AddRoleToUserUcDef,
  GetUserByTelegramIdUcDef,
  RemoveRoleFromUserUcDef,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { userActor } from '../../core/user-actor.test-kit';
import { testCallers } from '../peer-review/stories/peer-review-dmg.test-kit';
import { dmgDispatch, refuse } from '../streams/stories/stream-dmg.test-kit';
import { SchoolController } from './controller';

describe('SchoolController (реестр)', () => {
  const actor = userActor({
    uuid: '11111111-1111-4111-8111-111111111111',
    name: 'Гость',
    telegramId: 123456,
    roles: ['GUEST'],
  });

  const session: BotSession = {
    dialog: { path: 'school/hub', seq: 1 },
  };

  test('имя контроллера — school', () => {
    const controller = new SchoolController();
    expect(controller.name).toBe('school');
  });

  test('содержит SchoolHubStory, SchoolInfoStory, SchoolReviewsStory и CommunityStory', () => {
    const controller = new SchoolController();
    const stories = (
      controller as unknown as { stories: Array<{ name: string }> }
    ).stories;
    expect(stories.some((s) => s.name === 'hub')).toBe(true);
    expect(stories.some((s) => s.name === 'info')).toBe(true);
    expect(stories.some((s) => s.name === 'reviews')).toBe(true);
    expect(stories.some((s) => s.name === 'community')).toBe(true);
  });

  test('menuButtons агрегирует кнопку «🏫 Школа» с префиксом контроллера', async () => {
    const controller = new SchoolController();
    controller.init({
      school: TEST_SCHOOL,
      appApi: { dispatch: dmgDispatch({ getUsersByIds: () => [] }) },
      callers: testCallers,
    } as any);

    const items = await controller.menuButtons(actor);
    expect(items).toHaveLength(1);
    const btn = items[0]!;
    expect(btn.text).toBe('🏫 Школа');
    expect(btn.priority).toBe(10);
    expect(btn.kind).toBe('callback');
    if (btn.kind === 'callback') {
      expect(btn.action).toBe('school:hub:open');
    }
  });

  test('handleCallback форвардит hub:open в SchoolHubStory и возвращает карточку SH01 с кнопками', async () => {
    const controller = new SchoolController();
    controller.init({
      school: TEST_SCHOOL,
      appApi: { dispatch: dmgDispatch({ getUsersByIds: () => [] }) },
      callers: testCallers,
    } as any);

    const response = await controller.handleCallback(
      'hub:open',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain(TEST_SCHOOL.name);

    const rows = response.screen?.keyboard?.rows ?? [];
    expect(rows).toHaveLength(5);
    expect(rows[0]![0]!.text).toBe('📚 Потоки');
    expect(rows[1]![0]!.text).toBe('💬 Отзывы');
    expect(rows[1]![0]!.code).toBe('school:reviews:list');
    expect(rows[2]![0]!.text).toBe('ℹ️ Инфо');
    expect(rows[2]![0]!.code).toBe('school:info:view');
    expect(rows[3]![0]!.text).toBe('👥 Сообщество');
    expect(rows[3]![0]!.url).toBe(TEST_SCHOOL.communityGroup.url);
    expect(rows[4]![0]!.text).toBe('↩️ Главное меню');
  });

  test('handleCallback форвардит info:view в SchoolInfoStory и возвращает экран SH02 с кнопкой возврата', async () => {
    const controller = new SchoolController();
    controller.init({
      school: TEST_SCHOOL,
      appApi: { dispatch: dmgDispatch({ getUsersByIds: () => [] }) },
      callers: testCallers,
    } as any);

    const response = await controller.handleCallback(
      'info:view',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain(TEST_SCHOOL.name);
    expect(text).toContain('Мы учим быть программистом');
    expect(text).toContain('BatysHub');
    expect(text).toContain('Исатая');
    expect(text).toContain('777 287 8182');

    const rows = response.screen?.keyboard?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]![0]!.text).toBe('⬅️ Назад в школу');
    expect(rows[0]![0]!.code).toBe('school:hub:open');
  });

  test('handleCallback форвардит reviews:list в SchoolReviewsStory и возвращает экран SH03 с кнопкой возврата', async () => {
    const controller = new SchoolController();
    controller.init({
      school: TEST_SCHOOL,
      appApi: {
        dispatch: dmgDispatch({ listStreams: () => [] }),
      },
      callers: testCallers,
    } as any);

    const response = await controller.handleCallback(
      'reviews:list',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Пока нет отзывов о школе');

    const rows = response.screen?.keyboard?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]![0]!.text).toBe('⬅️ Назад в школу');
    expect(rows[0]![0]!.code).toBe('school:hub:open');
  });

  describe('handleMessengerEvent', () => {
    const ADMIN_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const TARGET_UUID = '77777777-7777-4777-8777-777777777777';

    const targetView = {
      uuid: TARGET_UUID,
      name: 'Иван',
      telegramId: 777,
      roles: ['GUEST'],
      createdAt: 1,
      updatedAt: 1,
      version: 0,
    };

    /** Ответы модуля `user`: `777` известен, остальные — `USER_NOT_FOUND`. */
    function setupController(answers: Record<string, () => unknown> = {}) {
      const controller = new SchoolController();
      const dispatch = dmgDispatch(
        {
          getUserByTelegramId: (input) =>
            (input as { telegramId: number }).telegramId === 777
              ? targetView
              : refuse('USER_NOT_FOUND', 'not_found'),
          addRoleToUser: () => targetView,
          removeRoleFromUser: () => targetView,
          ...answers,
        },
        [UserModuleDef],
      );
      const resolve = mock(async (uuid: string | undefined) => ({ uuid }));

      controller.init({
        school: TEST_SCHOOL,
        appApi: { dispatch },
        callers: { resolve },
        botAdminUuid: ADMIN_UUID,
      } as any);

      const commands = () => dispatch.mock.calls.map((c) => c[1]);
      const callerUuids = () => resolve.mock.calls.map((c) => c[0]);
      return { controller, commands, callerUuids };
    }

    const lookup = GetUserByTelegramIdUcDef.command({ telegramId: 777 });
    const subscriberCmd = {
      userId: TARGET_UUID,
      role: 'SUBSCRIBER' as const,
    };

    test('bot_membership(status: added) в группе школы выдаёт роль SUBSCRIBER от botAdminUuid и возвращает stop', async () => {
      const { controller, commands, callerUuids } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'bot_membership',
        chatId: String(TEST_SCHOOL.communityGroup.id),
        status: 'added',
        byUser: { id: 777, firstName: 'Иван' },
      });

      expect(result).toBe('stop');
      expect(commands()).toEqual([
        lookup,
        AddRoleToUserUcDef.command(subscriberCmd),
      ]);
      expect(callerUuids()).toEqual([undefined, ADMIN_UUID]);
    });

    test('member_joined в группе школы выдаёт роль SUBSCRIBER и возвращает stop', async () => {
      const { controller, commands } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'member_joined',
        chatId: String(TEST_SCHOOL.communityGroup.id),
        user: { id: 777, firstName: 'Иван' },
      });

      expect(result).toBe('stop');
      expect(commands()).toEqual([
        lookup,
        AddRoleToUserUcDef.command(subscriberCmd),
      ]);
    });

    test('member_left в группе школы снимает роль SUBSCRIBER и возвращает stop', async () => {
      const { controller, commands, callerUuids } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'member_left',
        chatId: String(TEST_SCHOOL.communityGroup.id),
        user: { id: 777, firstName: 'Иван' },
      });

      expect(result).toBe('stop');
      expect(commands()).toEqual([
        lookup,
        RemoveRoleFromUserUcDef.command(subscriberCmd),
      ]);
      expect(callerUuids()).toEqual([undefined, ADMIN_UUID]);
    });

    test('bot_membership(status: removed) в группе школы возвращает stop без вызовов user', async () => {
      const { controller, commands } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'bot_membership',
        chatId: String(TEST_SCHOOL.communityGroup.id),
        status: 'removed',
        byUser: { id: 777, firstName: 'Иван' },
      });

      expect(result).toBe('stop');
      expect(commands()).toEqual([]);
    });

    test('события в чужой группе возвращают pass и не вызывают user', async () => {
      const { controller, commands } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'member_joined',
        chatId: '-999999999',
        user: { id: 777, firstName: 'Иван' },
      });

      expect(result).toBe('pass');
      expect(commands()).toEqual([]);
    });

    test('нет пользователя с таким telegramId — пропуск: stop, роль не меняется', async () => {
      const { controller, commands } = setupController();

      const result = await controller.handleMessengerEvent({
        kind: 'member_joined',
        chatId: String(TEST_SCHOOL.communityGroup.id),
        user: { id: 404, firstName: 'Чужой' },
      });

      expect(result).toBe('stop');
      expect(commands()).toEqual([
        GetUserByTelegramIdUcDef.command({ telegramId: 404 }),
      ]);
    });

    test('Err поиска (не NOT_FOUND) — warn «Ошибка при обработке события…» и stop', async () => {
      const warn = mock(() => {});
      setGlobalLogger({ warn } as never);
      const { controller } = setupController({
        getUserByTelegramId: () => refuse('CORE_INTERNAL', 'internal'),
      });

      const result = await BotRequestContext.run(1, () =>
        controller.handleMessengerEvent({
          kind: 'member_joined',
          chatId: String(TEST_SCHOOL.communityGroup.id),
          user: { id: 777, firstName: 'Иван' },
        }),
      );

      expect(result).toBe('stop');
      expect(warn).toHaveBeenCalledTimes(1);
      const [source, message] = warn.mock.calls[0] as unknown as string[];
      expect(source).toBe('school-controller');
      expect(message).toContain('Ошибка при обработке события школьной группы');
    });

    test('отказ выдачи роли — warn «Ошибка при обработке события…» и stop', async () => {
      const warn = mock(() => {});
      setGlobalLogger({ warn } as never);
      const { controller } = setupController({
        addRoleToUser: () => refuse('CORE_ACCESS_DENIED', 'access_denied'),
      });

      const result = await BotRequestContext.run(1, () =>
        controller.handleMessengerEvent({
          kind: 'member_joined',
          chatId: String(TEST_SCHOOL.communityGroup.id),
          user: { id: 777, firstName: 'Иван' },
        }),
      );

      expect(result).toBe('stop');
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
