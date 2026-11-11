import { describe, expect, test } from 'bun:test';
import type { BotSession } from '@u7-scl/core/ui';
import { userActor } from '../../core/user-actor.test-kit';
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
      getUser: () => ({ uuid: 'm1', name: 'Ментор', roles: ['GUEST'] }),
    }),
  } as never;

  const makeController = () => new StreamsController();

  const guestActor = userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaaaaa9',
    name: 'Гость',
    telegramId: 123,
    roles: ['GUEST'],
  });

  const session: BotSession = {
    dialog: { path: 'stream/catalog', seq: 1 },
  };

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
});
