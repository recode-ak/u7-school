import { describe, expect, test } from 'bun:test';
import type { EventEnvelope } from '../app/events/event-envelope';
import { AwaitingBus } from './awaiting-bus';
import { TaskEvents } from './example/todo/task/task.events';

const envelope = (name: string, eventId: string): EventEnvelope => ({
  name,
  payload: {},
  eventId,
  occurredAt: 0,
  aggregateId: 'a-1',
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

/** Несколько шагов микрозадач: обработчик завершается не сразу. */
async function later(steps = 5): Promise<void> {
  for (let i = 0; i < steps; i++) await Promise.resolve();
}

describe('AwaitingBus', () => {
  test('delivered() дожидается запущенных обработчиков', async () => {
    const bus = new AwaitingBus();
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async (e) => {
      await later();
      got.push(e.eventId);
    });
    bus.publish(envelope(TaskEvents.created.name, 'e-1'));
    expect(got).toEqual([]);
    await bus.delivered();
    expect(got).toEqual(['e-1']);
    expect(bus.published.map((e) => e.eventId)).toEqual(['e-1']);
  });

  test('delivered() дожидается и обработчиков, запущенных обработчиками', async () => {
    const bus = new AwaitingBus();
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async () => {
      await later();
      bus.publish(envelope(TaskEvents.completed.name, 'e-2'));
    });
    bus.subscribe(TaskEvents.completed, async (e) => {
      await later();
      got.push(e.eventId);
    });
    bus.publish(envelope(TaskEvents.created.name, 'e-1'));
    await bus.delivered();
    expect(got).toEqual(['e-2']);
  });

  test('отказ одного обработчика не теряет остальных: ждёт всех и пробрасывает первую ошибку', async () => {
    const bus = new AwaitingBus();
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async () => {
      throw new Error('первый');
    });
    bus.subscribe(TaskEvents.created, async () => {
      await later();
      throw new Error('второй');
    });
    // Медленный: завершается заметно позже отказа первого.
    bus.subscribe(TaskEvents.created, async (e) => {
      await later(100);
      got.push(e.eventId);
    });
    bus.publish(envelope(TaskEvents.created.name, 'e-1'));
    const error = await bus.delivered().then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toEqual(new Error('первый'));
    expect(got).toEqual(['e-1']);
  });

  test('без обработчиков delivered() завершается сразу', async () => {
    const bus = new AwaitingBus();
    bus.publish(envelope(TaskEvents.created.name, 'e-1'));
    await bus.delivered();
    expect(bus.published).toHaveLength(1);
  });
});
