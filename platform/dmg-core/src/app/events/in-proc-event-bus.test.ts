import { describe, expect, test } from 'bun:test';
import { TaskEvents } from '#core/testing/example/todo/task/task.events';
import { MemoryLogger } from '#core/testing/index';
import type { EventEnvelope } from './event-envelope';
import { InProcEventBus } from './in-proc-event-bus';

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

/** Логгер, который сообщает о первой записи `error` без таймеров. */
class SignalLogger extends MemoryLogger {
  private signal: () => void = () => {};
  readonly logged = new Promise<void>((resolve) => {
    this.signal = resolve;
  });

  override error(source: string, message: string): void {
    super.error(source, message);
    this.signal();
  }
}

describe('InProcEventBus', () => {
  test('доставляет конверт подписчикам по имени события в порядке подписки', () => {
    const bus = new InProcEventBus(new MemoryLogger());
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(`first:${e.eventId}`);
    });
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(`second:${e.eventId}`);
    });
    bus.subscribe(TaskEvents.completed, async (e) => {
      got.push(`completed:${e.eventId}`);
    });
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual(['first:e-1', 'second:e-1']);
  });

  test('отписка прекращает доставку только этому обработчику', () => {
    const bus = new InProcEventBus(new MemoryLogger());
    const got: string[] = [];
    const off = bus.subscribe(TaskEvents.created, async () => {
      got.push('off');
    });
    bus.subscribe(TaskEvents.created, async () => {
      got.push('on');
    });
    off();
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual(['on']);
  });

  test('не ждёт обработчиков: висящий обработчик не задерживает следующего', () => {
    const bus = new InProcEventBus(new MemoryLogger());
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, () => new Promise(() => {}));
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual(['e-1']);
  });

  test('после отписки последнего обработчика подписка по тому же событию снова работает', () => {
    const bus = new InProcEventBus(new MemoryLogger());
    const got: string[] = [];
    const off = bus.subscribe(TaskEvents.created, async () => {
      got.push('old');
    });
    off();
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    off();
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual(['e-1']);
  });

  test('синхронное исключение обработчика → logger.error, остальные получают конверт', () => {
    const logger = new MemoryLogger();
    const bus = new InProcEventBus(logger);
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, () => {
      throw new Error('сбой');
    });
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    expect(() => bus.publish(envelope(created, 'e-1'))).not.toThrow();
    expect(got).toEqual(['e-1']);
    expect(logger.records).toHaveLength(1);
    const [record] = logger.records;
    expect(record?.level).toBe('error');
    expect(record?.source).toBe('event-bus');
    expect(record?.message).toContain(created);
    expect(record?.message).toContain('сбой');
  });

  test('отказ промиса обработчика → logger.error, остальные получают конверт', async () => {
    const logger = new SignalLogger();
    const bus = new InProcEventBus(logger);
    const got: string[] = [];
    bus.subscribe(TaskEvents.created, async () => {
      throw new Error('отказ');
    });
    bus.subscribe(TaskEvents.created, async (e) => {
      got.push(e.eventId);
    });
    bus.publish(envelope(created, 'e-1'));
    expect(got).toEqual(['e-1']);
    await logger.logged;
    expect(logger.records).toHaveLength(1);
    const [record] = logger.records;
    expect(record?.source).toBe('event-bus');
    expect(record?.message).toContain(created);
    expect(record?.message).toContain('отказ');
  });

  test('отказ не-Error значением — текст ошибки строкой', async () => {
    const logger = new SignalLogger();
    const bus = new InProcEventBus(logger);
    bus.subscribe(TaskEvents.created, () => Promise.reject('строка'));
    bus.publish(envelope(created, 'e-1'));
    await logger.logged;
    expect(logger.records[0]?.message).toContain('строка');
  });
});
