import { describe, expect, test } from 'bun:test';
import { type EnvelopeOf, systemCaller } from '#dmg/index';
import { TaskEvents } from '#dmg/testing/example/todo/index';
import type { DomainEvent as LegacyEvent } from '#domain-legacy/events/domain-event';
import { InProcEventBus } from '../infra/in-proc-event-bus';
import { legacyEventBus } from './legacy-event-bus';

const AT = Date.UTC(2026, 9, 18, 12, 0);

function completed(): EnvelopeOf<typeof TaskEvents.completed> {
  return {
    ...TaskEvents.completed.make({ taskId: 't-1', ownerId: 'u-1' }),
    eventId: 'e-1',
    occurredAt: AT,
    aggregateId: 't-1',
    caller: systemCaller('test'),
    cause: { kind: 'request', requestId: 'r-1' },
    correlationId: 'r-1',
  };
}

/** Дать отработать обработчикам: legacy-шина не ждёт их промисы. */
const tick = () => Promise.resolve();

describe('legacyEventBus', () => {
  test('подписчик DMG получает конверт по Def события', async () => {
    const bus = legacyEventBus(new InProcEventBus());
    const got: EnvelopeOf<typeof TaskEvents.completed>[] = [];
    bus.subscribe(TaskEvents.completed, async (e) => {
      got.push(e);
    });
    bus.publish(completed());
    await tick();
    expect(got).toEqual([completed()]);
  });

  test('legacy-подписчик получает событие в старой форме', async () => {
    const legacy = new InProcEventBus();
    const got: LegacyEvent[] = [];
    legacy.subscribe('todo.task.completed', async (e) => {
      got.push(e);
    });
    legacyEventBus(legacy).publish(completed());
    await tick();
    expect(got).toEqual([
      {
        eventId: 'e-1',
        eventName: 'todo.task.completed',
        occurredAt: '2026-10-18T12:00:00.000Z',
        aggregateName: 'todo.task',
        aggregateId: 't-1',
        payload: { taskId: 't-1', ownerId: 'u-1' },
      },
    ]);
  });

  test('событие legacy-кода с тем же именем подписчику DMG не приходит', async () => {
    const legacy = new InProcEventBus();
    let calls = 0;
    legacyEventBus(legacy).subscribe(TaskEvents.completed, async () => {
      calls++;
    });
    legacy.publish({
      eventId: 'x',
      eventName: 'todo.task.completed',
      occurredAt: '2026-10-18T12:00:00.000Z',
      aggregateName: 'todo.task',
      aggregateId: 't-1',
      payload: {},
    });
    await tick();
    expect(calls).toBe(0);
  });

  test('отписка снимает обработчик', async () => {
    const bus = legacyEventBus(new InProcEventBus());
    let calls = 0;
    const off = bus.subscribe(TaskEvents.completed, async () => {
      calls++;
    });
    off();
    bus.publish(completed());
    await tick();
    expect(calls).toBe(0);
  });
});
