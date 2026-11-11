import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import type { BotSession } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/user/domain';
import { UserCaller } from 'dmg-core';
import { CoursesController } from './controller';
import { dmgDispatch } from './stories/course-dmg.test-kit';

describe('CoursesController (реестр)', () => {
  // Каталог читает UC listCourses (DMG): доступных курсов нет
  const mockAppApi = {
    dispatch: dmgDispatch({ listCourses: () => [] }),
  } as never;

  const makeController = () => new CoursesController();

  const guestActor: User = {
    uuid: 'u1',
    name: 'Гость',
    telegramId: 123,
    roles: [Role.GUEST],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const session: BotSession = {
    dialog: { path: 'course/course-catalog', seq: 1 },
  };

  /** Резолвер `Caller` приложения (D-50): актор бота зарегистрирован. */
  const callers = {
    resolve: async () => new UserCaller(guestActor),
  };

  test('имя контроллера — course', () => {
    const controller = makeController();
    expect(controller.name).toBe('course');
  });

  test('содержит 3 story (каталог + приглашение + уведомление менторам)', () => {
    const controller = makeController();
    const stories = (controller as unknown as { stories: unknown[] }).stories;
    expect(stories.length).toBe(3);
  });

  test('menuButtons агрегирует кнопки от stories с префиксом контроллера', async () => {
    const controller = makeController();
    controller.init({ appApi: mockAppApi, callers } as never);

    const items = await controller.menuButtons(guestActor);

    expect(items.length).toBeGreaterThanOrEqual(1);
    const texts = items.map((i) => i.text);
    expect(texts).toContain('📖 Курсы');
    const callback = items.find((i) => i.kind === 'callback');
    if (callback?.kind === 'callback') {
      expect(callback.action).toBe('course:course-catalog:list');
    }
  });

  test('handleCallback форвардит по префиксу story', async () => {
    const controller = makeController();
    controller.init({ appApi: mockAppApi, callers } as never);

    const response = await controller.handleCallback(
      'course-catalog:list',
      guestActor,
      session,
    );
    expect(response.screen?.text).toBeDefined();
    expect(String(response.screen?.text)).toContain('Курсы');
  });

  test('handleCallback — неизвестный префикс', async () => {
    const controller = makeController();

    const response = await controller.handleCallback(
      'unknown:action',
      guestActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('Неизвестная');
  });
});
