import { describe, expect, test } from 'bun:test';
import type { DomainEvent as LegacyEvent } from '@u7-scl/core/domain';
import { InProcEventBus } from '@u7-scl/core/infra';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import type { EventBus, EventEnvelope } from 'dmg-core/app';
import { publishWishEvents } from './legacy-publish';

const AT = Date.UTC(2026, 9, 20, 12, 0);
const wishId = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const payload = {
  userId: '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6',
  courseId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
};

/** Событие-причина legacy-шины (вход ER). */
const cause: LegacyEvent = {
  eventId: 'cause-1',
  eventName: 'questionnaire:complete',
  occurredAt: '2026-10-20T11:00:00.000Z',
  aggregateName: 'Questionnaire',
  aggregateId: 'q-1',
  payload: {},
};

/** Дать отработать обработчикам: legacy-шина не ждёт их промисы. */
const tick = () => Promise.resolve();

describe('publishWishEvents', () => {
  test('legacy-подписчик получает событие по FQN с payload Def', async () => {
    const legacy = new InProcEventBus();
    const got: LegacyEvent[] = [];
    legacy.subscribe(WishEvents.confirmed.name, async (e) => {
      got.push(e);
    });

    publishWishEvents(legacyEventBus(legacy), {
      events: [WishEvents.confirmed.make(payload)],
      aggregateId: wishId,
      source: 'confirm-wish',
      cause,
      at: AT,
    });
    await tick();

    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      eventName: 'wish.wish.confirmed',
      aggregateId: wishId,
      occurredAt: new Date(AT).toISOString(),
      payload,
    });
  });

  test('конверт DMG: системный вызывающий ER, причина и цепочка — событие-причина', () => {
    const got: EventEnvelope[] = [];
    const bus: EventBus = {
      publish: (e) => {
        got.push(e);
      },
      subscribe: () => () => {},
    };

    publishWishEvents(bus, {
      events: [WishEvents.confirmed.make(payload)],
      aggregateId: wishId,
      source: 'confirm-wish',
      cause,
      at: AT,
    });

    expect(got).toEqual([
      {
        name: 'wish.wish.confirmed',
        payload,
        eventId: expect.any(String),
        occurredAt: AT,
        aggregateId: wishId,
        caller: { kind: 'system', source: 'confirm-wish' },
        cause: { kind: 'event', eventId: 'cause-1' },
        correlationId: 'cause-1',
      },
    ]);
  });

  test('нет событий — ничего не публикуется', async () => {
    const legacy = new InProcEventBus();
    const got: LegacyEvent[] = [];
    legacy.subscribe(WishEvents.confirmed.name, async (e) => {
      got.push(e);
    });

    publishWishEvents(legacyEventBus(legacy), {
      events: [],
      aggregateId: wishId,
      source: 'confirm-wish',
      cause,
      at: AT,
    });
    await tick();

    expect(got).toEqual([]);
  });
});
