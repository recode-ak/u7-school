import { describe, expect, test } from 'bun:test';
import { systemCaller } from 'dmg-core';
import type { EnvelopeOf } from 'dmg-core/app';
import { TaskEvents } from 'dmg-core/testing/example/todo/index';
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

describe('legacyEventBus — входящие legacy-события (D-37)', () => {
  const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
  const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
  const legacyDone = (payload: Record<string, unknown>): LegacyEvent => ({
    eventId: 'L-1',
    eventName: 'task:done',
    occurredAt: '2026-10-18T12:00:00.000Z',
    aggregateName: 'Task',
    aggregateId: TASK,
    payload,
  });
  const inbound = [
    {
      legacy: 'task:done',
      def: TaskEvents.completed,
      payload: (e: LegacyEvent) => ({
        taskId: e.aggregateId,
        ownerId: e.payload.owner,
      }),
    },
  ];

  test('событие по карте приходит подписчику DMG в конверте Def', async () => {
    const legacy = new InProcEventBus();
    const got: EnvelopeOf<typeof TaskEvents.completed>[] = [];
    legacyEventBus(legacy, { inbound }).subscribe(
      TaskEvents.completed,
      async (e) => {
        got.push(e);
      },
    );
    legacy.publish(legacyDone({ owner: OWNER }));
    await tick();
    expect(got).toEqual([
      {
        name: 'todo.task.completed',
        payload: { taskId: TASK, ownerId: OWNER },
        eventId: 'L-1',
        occurredAt: AT,
        aggregateId: TASK,
        caller: systemCaller('legacy:task:done'),
        cause: { kind: 'event', eventId: 'L-1' },
        correlationId: 'L-1',
      },
    ]);
  });

  test('payload не прошёл схему Def — onInvalid, подписчик не вызван', async () => {
    const legacy = new InProcEventBus();
    const invalid: string[] = [];
    let calls = 0;
    legacyEventBus(legacy, {
      inbound,
      onInvalid: (m) => invalid.push(m),
    }).subscribe(TaskEvents.completed, async () => {
      calls++;
    });
    legacy.publish(legacyDone({}));
    await tick();
    expect(calls).toBe(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toContain('task:done');
  });
});
