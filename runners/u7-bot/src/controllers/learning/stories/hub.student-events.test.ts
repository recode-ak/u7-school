import { describe, expect, mock, test } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef, StudentEvents } from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/user/domain';
import {
  dmgDispatch,
  moduleNotFound,
} from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { HubStory } from './hub';

// Уведомление 7c/7d, которое раньше слал UC `complete-student`, теперь шлёт
// стори по событию `stream.student.completed` (решение 17 брифа среза student):
// `outcome = advanced` и нет следующего модуля → `proactiveSender.notify`,
// kind `info`; остальное — без изменений (7a/7b — invite). Событие приходит в
// legacy-форме шины: `eventName` — FQN Def.

const MODULES = [CourseModuleDef, StreamModuleDef];

const USER = '22222222-2222-4222-8222-222222222222';
const MODULE = '33333333-3333-4333-8333-333333333333';
const NEXT = '55555555-5555-4555-8555-555555555555';

const event = (outcome: 'advanced' | 'not_advanced') => ({
  eventId: crypto.randomUUID(),
  eventName: StudentEvents.completed.name,
  occurredAt: '2026-08-28T12:00',
  aggregateName: 'student',
  aggregateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  payload: {
    studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: USER,
    streamId: '11111111-1111-4111-8111-111111111111',
    moduleId: MODULE,
    outcome,
  },
});

function makeStory(
  place: unknown,
  options: { telegramId?: number } = { telegramId: 123 },
) {
  const { telegramId } = options;
  const appApi = {
    execute: mock(async (name: string) => {
      if (name === 'get-user')
        return {
          uuid: USER,
          name: 'Студент',
          telegramId,
          roles: [Role.STUDENT],
        };
      return undefined;
    }),
    dispatch: dmgDispatch({ getModulePlace: () => place }, MODULES),
  };
  const sender = {
    notify: mock(async () => {}),
    invite: mock(async () => {}),
    kickFromGroup: mock(async () => {}),
  };
  const story = new HubStory();
  story.init({ appApi, callers: testCallers } as never, sender as never);
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.eventName === StudentEvents.completed.name);
  return { sender, sub };
}

describe('HubStory — подписка на StudentEvents.completed', () => {
  test('подписка идёт на FQN Def, а не на legacy-имя student.completed', () => {
    const { sub } = makeStory(undefined);
    expect(sub?.eventName).toBe('stream.student.completed');
    const names = new HubStory()
      .getEventSubscriptions()
      .map((s) => s.eventName);
    expect(names).not.toContain('student.completed');
  });

  test('advanced, место известно, модуль последний → notify «Курс завершён» (7c), kind info', async () => {
    const { sender, sub } = makeStory({ isLast: true, isFirst: false });
    await sub?.handle(event('advanced') as never);

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [tg, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(tg).toBe(123);
    expect(payload.kind).toBe('info');
    expect(String(payload.text)).toContain('Курс завершён');
    expect(String(payload.text)).toContain('Поздравляем');
  });

  test('advanced, место неизвестно → notify «Модуль завершён» (7d)', async () => {
    const { sender, sub } = makeStory(undefined);
    await sub?.handle(event('advanced') as never);

    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(String(payload.text)).toContain('Модуль завершён');
  });

  test('advanced, место модуля не определено (отказ UC) → notify «Модуль завершён» (7d)', async () => {
    const { sender, sub } = makeStory(moduleNotFound());
    await sub?.handle(event('advanced') as never);

    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(String(payload.text)).toContain('Модуль завершён');
  });

  test('advanced + есть следующий модуль → только invite 7a, notify нет', async () => {
    const { sender, sub } = makeStory({ isLast: false, nextModuleId: NEXT });
    await sub?.handle(event('advanced') as never);

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).toHaveBeenCalledTimes(1);
  });

  test('not_advanced → только invite 7b «Пройти модуль снова», notify нет', async () => {
    const { sender, sub } = makeStory({ isLast: true });
    await sub?.handle(event('not_advanced') as never);

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).toHaveBeenCalledTimes(1);
  });

  test('у пользователя нет telegramId → ни notify, ни invite', async () => {
    const { sender, sub } = makeStory({ isLast: true }, {});
    await sub?.handle(event('advanced') as never);

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).not.toHaveBeenCalled();
  });
});
