import { describe, expect, mock, test } from 'bun:test';
import type { EventBus } from '@u7-scl/core/domain';
import type {
  UserApiModuleResolver,
  UserNotifiedEvent,
} from '@u7-scl/domain/user';
import { NotifyUserUc } from './notify-user-uc';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('NotifyUserUc', () => {
  function setup() {
    const publish = mock((_event: UserNotifiedEvent) => {});
    const eventBus = { publish } as unknown as EventBus;
    const uc = new NotifyUserUc();
    uc.init({
      userRepo: {},
      appResolver: {},
      eventBus,
    } as unknown as UserApiModuleResolver);
    return { publish, uc };
  }

  test('публикует user.notified с payload {userId, text}', async () => {
    const { publish, uc } = setup();

    await uc.execute({ userId, text: 'Привет!' });

    expect(publish).toHaveBeenCalledTimes(1);
    const event = (publish as ReturnType<typeof mock>).mock
      .calls[0]![0] as UserNotifiedEvent;
    expect(event.eventName).toBe('user.notified');
    expect(event.aggregateName).toBe('User');
    expect(event.aggregateId).toBe(userId);
    expect(event.payload).toEqual({
      userId,
      text: 'Привет!',
      kind: undefined,
    });
    expect(event.eventId).toBeDefined();
    expect(event.occurredAt).toBeDefined();
  });

  test('пробрасывает kind в payload события', async () => {
    const { publish, uc } = setup();

    await uc.execute({ userId, text: 'Текст', kind: 'warn' });

    const event = (publish as ReturnType<typeof mock>).mock
      .calls[0]![0] as UserNotifiedEvent;
    expect(event.payload.kind).toBe('warn');
  });

  test.each([
    { title: 'обычный текст — проходит и публикуется', text: 'Текст' },
    {
      title: 'только пробелы — отказ',
      text: '   ',
      error: 'INPUT_VALIDATION_ERROR',
    },
    {
      title: 'длиннее 3500 — отказ',
      text: 'а'.repeat(3501),
      error: 'INPUT_VALIDATION_ERROR',
    },
  ])('handle: $title', async ({ text, error }) => {
    const { publish, uc } = setup();

    if (error) {
      await expect(uc.handle({ userId, text })).rejects.toMatchObject({
        error: { name: error },
      });
      expect(publish).not.toHaveBeenCalled();
      return;
    }

    await uc.handle({ userId, text });
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
