import { describe, expect, mock, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import type { BotSession } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/user/domain';
import { testCallers } from '../peer-review/stories/peer-review-dmg.test-kit';
import { StreamsController } from './controller';
import { dmgDispatch, streamView } from './stories/stream-dmg.test-kit';

describe('StreamsController (реестр)', () => {
  // Каталог читает UC listStreams (DMG); карточка потока — getStream и getStreamMembers
  const mockAppApi = {
    dispatch: dmgDispatch({
      listStreams: () => [
        streamView({
          uuid: 'e-e-e-e-e-e-e-e-e-e-e-e-e-e-e-e',
          title: 'Поток',
          status: 'enrollment',
        }),
      ],
      getStream: () =>
        streamView({
          uuid: 's-s-s-s-s-s-s-s-s-s-s-s-s-s-s-s',
          title: 'Test',
          description: 'Описание',
          status: 'active',
        }),
      getStreamMembers: () => ({ mentorId: 'm1', students: [] }),
      listScopeFacts: () => ({ hasReviews: false, reviewsCount: 0 }),
    }),
    execute: mock((name: string) => {
      if (name === 'list-stream-students') return [];
      if (name === 'get-user') return { uuid: 'm1', name: 'Ментор', roles: [] };
      return undefined;
    }),
  } as never;

  const makeController = () => new StreamsController();

  const guestActor: User = {
    uuid: 'u1',
    name: 'Гость',
    telegramId: 123,
    roles: [Role.GUEST],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const session: BotSession = {
    dialog: { path: 'stream/catalog', seq: 1 },
  };

  test('имя контроллера — stream', () => {
    const controller = makeController();
    expect(controller.name).toBe('stream');
  });

  test('содержит 3 stories (catalog + view-stream + inactivity)', () => {
    const controller = makeController();
    const stories = (controller as unknown as { stories: unknown[] }).stories;
    expect(stories.length).toBe(3);
  });

  test('menuButtons пуст (сторис не экспортируют кнопок в главное меню)', async () => {
    const controller = makeController();
    controller.init({ appApi: mockAppApi, callers: testCallers } as never);

    const items = await controller.menuButtons(guestActor);
    expect(items).toHaveLength(0);
  });

  test('handleCallback форвардит catalog:list', async () => {
    const controller = makeController();
    controller.init({ appApi: mockAppApi, callers: testCallers } as never);

    const response = await controller.handleCallback(
      'catalog:list',
      guestActor,
      session,
    );
    expect(response.screen?.text).toBeDefined();
    expect(String(response.screen?.text)).toContain('Потоки');
  });

  test('handleCallback форвардит view-stream:view', async () => {
    const controller = makeController();
    controller.init({ appApi: mockAppApi, callers: testCallers } as never);

    const response = await controller.handleCallback(
      'view-stream:view:s-s-s-s-s-s-s-s-s-s-s-s-s-s-s-s',
      guestActor,
      session,
    );
    expect(response.screen?.text).toBeDefined();
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
