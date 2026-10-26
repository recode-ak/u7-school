import { afterEach, describe, expect, spyOn, test } from 'bun:test';
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
  const route = {
    legacy: 'task:done',
    def: TaskEvents.completed,
    payload: (e: LegacyEvent) => ({
      taskId: e.aggregateId,
      ownerId: e.payload.owner,
    }),
  };
  const inbound = [route];

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
        cause: { kind: 'event', eventId: 'L-1' },
        correlationId: 'L-1',
      },
    ]);
    // Вызывающего в конверте нет (D-43, Р7) — условной операции `legacy` тоже.
    expect(got[0]).not.toHaveProperty('caller');
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

  test('маршрут разбирается один раз: onInvalid один раз на два подписчика', async () => {
    const legacy = new InProcEventBus();
    const invalid: string[] = [];
    let calls = 0;
    const bus = legacyEventBus(legacy, {
      inbound,
      onInvalid: (m) => invalid.push(m),
    });
    for (let i = 0; i < 2; i++) {
      bus.subscribe(TaskEvents.completed, async () => {
        calls++;
      });
    }
    legacy.publish(legacyDone({}));
    await tick();
    expect(calls).toBe(0);
    expect(invalid).toHaveLength(1);
  });

  test('валидное событие — payload строится один раз, получают все подписчики', async () => {
    const legacy = new InProcEventBus();
    let mapped = 0;
    const got: string[] = [];
    const bus = legacyEventBus(legacy, {
      inbound: [
        {
          ...route,
          payload: (e: LegacyEvent) => {
            mapped++;
            return route.payload(e);
          },
        },
      ],
    });
    bus.subscribe(TaskEvents.completed, async (e) => {
      got.push(`a:${e.eventId}`);
    });
    bus.subscribe(TaskEvents.completed, async (e) => {
      got.push(`b:${e.eventId}`);
    });
    legacy.publish(legacyDone({ owner: OWNER }));
    await tick();
    expect(mapped).toBe(1);
    expect(got).toEqual(['a:L-1', 'b:L-1']);
  });

  test('ошибка одного подписчика не мешает другому', async () => {
    const legacy = new InProcEventBus();
    const error = spyOn(console, 'error').mockImplementation(() => {});
    const got: string[] = [];
    const bus = legacyEventBus(legacy, { inbound });
    bus.subscribe(TaskEvents.completed, async () => {
      throw new Error('сбой');
    });
    bus.subscribe(TaskEvents.completed, async (e) => {
      got.push(e.eventId);
    });
    legacy.publish(legacyDone({ owner: OWNER }));
    // Раздача ждёт всех подписчиков — дождаться макрозадачи.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(got).toEqual(['L-1']);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test('отписка снимает обработчик входящего события', async () => {
    const legacy = new InProcEventBus();
    let calls = 0;
    const off = legacyEventBus(legacy, { inbound }).subscribe(
      TaskEvents.completed,
      async () => {
        calls++;
      },
    );
    off();
    legacy.publish(legacyDone({ owner: OWNER }));
    await tick();
    expect(calls).toBe(0);
  });

  test('невалидная дата legacy-события — onInvalid, подписчик не вызван', async () => {
    const legacy = new InProcEventBus();
    const invalid: string[] = [];
    let calls = 0;
    legacyEventBus(legacy, {
      inbound,
      onInvalid: (m) => invalid.push(m),
    }).subscribe(TaskEvents.completed, async () => {
      calls++;
    });
    legacy.publish({
      ...legacyDone({ owner: OWNER }),
      occurredAt: 'не дата',
    });
    await tick();
    expect(calls).toBe(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toContain('occurredAt');
  });

  describe('onInvalid по умолчанию', () => {
    let restore: (() => void) | undefined;
    afterEach(() => restore?.());

    test('предупреждение в console.warn, без исключения', async () => {
      const legacy = new InProcEventBus();
      const warn = spyOn(console, 'warn').mockImplementation(() => {});
      const error = spyOn(console, 'error').mockImplementation(() => {});
      restore = () => {
        warn.mockRestore();
        error.mockRestore();
      };
      legacyEventBus(legacy, { inbound }).subscribe(
        TaskEvents.completed,
        async () => {},
      );
      legacy.publish(legacyDone({}));
      await tick();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.join(' '))).toContain('task:done');
      expect(error).not.toHaveBeenCalled();
    });
  });
});
