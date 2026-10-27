import type { AppContext, AppMode } from '../app/context';
import type { EventEnvelope } from '../app/events/event-envelope';
import { InProcInbox } from '../app/events/inbox';
import { InProcOutbox } from '../app/events/outbox';
import type { OperationLog } from '../app/oplog/operation-record';
import type { Timestamp } from '../kernel/time/timestamp';
import { RecordingBus } from './memory-bus';
import { type LogRecord, MemoryLogger } from './memory-logger';
import { MemoryOperationLog } from './memory-operation-log';

/** Момент часов тестового контекста по умолчанию. */
export const TEST_NOW: Timestamp = Date.UTC(2026, 0, 1);

/**
 * Контекст приложения для тестов прикладного слоя: всё видно в массивах
 * (`published` — отданное в outbox, `oplog.records` — лог операций в
 * памяти; outbox и inbox — in-proc), часы стоят на `at` и
 * переводятся `setNow` — без глобального состояния. `options.oplog` —
 * подмена лога операций (например, сбойного); тогда `oplog` пуст.
 */
export function testAppContext(
  options: {
    readonly mode?: AppMode;
    readonly at?: Timestamp;
    readonly oplog?: OperationLog;
  } = {},
) {
  const published: EventEnvelope[] = [];
  const logs: LogRecord[] = [];
  const oplog = new MemoryOperationLog();
  let at = options.at ?? TEST_NOW;
  const bus = new RecordingBus(published);
  const app: AppContext = {
    bus,
    outbox: new InProcOutbox(bus),
    inbox: new InProcInbox(),
    clock: () => at,
    logger: new MemoryLogger(logs),
    mode: options.mode ?? 'test',
    oplog: options.oplog ?? oplog,
  };
  const setNow = (next: Timestamp): void => {
    at = next;
  };
  return { app, published, logs, oplog, setNow };
}
