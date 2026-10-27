import { describe, expect, test } from 'bun:test';
import type { EventEnvelope } from '../app/events/event-envelope';
import { TaskEvents } from './example/todo/task/task.events';
import { MemoryBus, RecordingBus } from './memory-bus';

const envelope = (name: string, eventId: string): EventEnvelope => ({
  name,
  payload: {},
  eventId,
  occurredAt: 0,
  aggregateId: 'a-1',
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

const created = TaskEvents.created.name;

describe('RecordingBus', () => {
  test('запоминает опубликованное, подписчикам не доставляет', () => {
    const bus = new RecordingBus();
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    bus.publish(envelope(created, 'e-1'));
    expect(bus.published.map((e) => e.eventId)).toEqual(['e-1']);
    expect(got).toEqual([]);
  });

  test('пишет в переданный массив', () => {
    const published: EventEnvelope[] = [];
    new RecordingBus(published).publish(envelope(created, 'e-1'));
    expect(published).toHaveLength(1);
  });
});

describe('MemoryBus', () => {
  test('доставляет подписчикам по имени события и запоминает', () => {
    const bus = new MemoryBus();
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    bus.publish(envelope(created, 'e-1'));
    bus.publish(envelope('todo.task.other', 'e-2'));
    expect(got).toEqual(['e-1']);
    expect(bus.published.map((e) => e.eventId)).toEqual(['e-1', 'e-2']);
  });

  test('отписка прекращает доставку', () => {
    const bus = new MemoryBus();
    const got: string[] = [];
    const off = bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    off();
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual([]);
  });

  test('не ждёт обработчиков (как боевая шина)', () => {
    const bus = new MemoryBus();
    bus.subscribe(TaskEvents.created, () => new Promise(() => {}));
    expect(() => bus.publish(envelope(created, 'e-1'))).not.toThrow();
  });
});
