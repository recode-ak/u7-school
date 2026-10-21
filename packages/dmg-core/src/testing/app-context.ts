import type { AppContext, AppMode, Logger } from '../app/context';
import type { EventBus } from '../app/events/event-bus';
import type { EventEnvelope } from '../app/events/event-envelope';
import type { OperationLog } from '../app/oplog/operation-record';
import type { Timestamp } from '../kernel/time/timestamp';
import { MemoryOperationLog } from './memory-operation-log';

export type LogRecord = {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly source: string;
  readonly message: string;
};

/** Логгер, который складывает записи в массив. */
export function memoryLogger(records: LogRecord[]): Logger {
  const write =
    (level: LogRecord['level']) => (source: string, message: string) => {
      records.push({ level, source, message });
    };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  };
}

/** Шина, которая только запоминает опубликованное. */
export function recordingBus(published: EventEnvelope[]): EventBus {
  return {
    publish: (envelope) => {
      published.push(envelope);
    },
    subscribe: () => () => {},
  };
}

/**
 * Шина в памяти: доставляет конверт подписчикам по имени события,
 * не дожидаясь обработчиков (как боевая шина).
 */
export function memoryBus(): EventBus {
  const handlers = new Map<
    string,
    Set<(envelope: EventEnvelope) => Promise<void>>
  >();
  return {
    publish: (envelope) => {
      for (const handler of handlers.get(envelope.name) ?? []) {
        void handler(envelope);
      }
    },
    subscribe: (def, handler) => {
      // Имя события уникально (D-10): конверт под этим именем имеет тип def.
      const wrapped = (envelope: EventEnvelope) =>
        handler(envelope as Parameters<typeof handler>[0]);
      const set = handlers.get(def.name) ?? new Set();
      set.add(wrapped);
      handlers.set(def.name, set);
      return () => {
        set.delete(wrapped);
      };
    },
  };
}

/** Момент часов тестового контекста по умолчанию. */
export const TEST_NOW: Timestamp = Date.UTC(2026, 0, 1);

/**
 * Контекст приложения для тестов прикладного слоя: всё видно в массивах
 * (`oplog.records` — лог операций в памяти), часы стоят на `at` и
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
  const app: AppContext = {
    bus: recordingBus(published),
    clock: () => at,
    logger: memoryLogger(logs),
    mode: options.mode ?? 'test',
    oplog: options.oplog ?? oplog,
  };
  const setNow = (next: Timestamp): void => {
    at = next;
  };
  return { app, published, logs, oplog, setNow };
}
