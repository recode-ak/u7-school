import type { AppEnvMode } from '#domain-legacy/types';
import { type Logger, LogLevel } from '#shared-legacy/logger';
import type { AppContext } from '../app/context';
import type { EventBus } from '../app/events/event-bus';
import type { EventEnvelope } from '../app/events/event-envelope';

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
    setLogLevel: () => {},
    getLogLevel: () => LogLevel.DEBUG,
    setSourceLevel: () => {},
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

/** Контекст приложения для тестов прикладного слоя: всё видно в массивах. */
export function testAppContext(mode: AppEnvMode = 'test') {
  const published: EventEnvelope[] = [];
  const logs: LogRecord[] = [];
  const app: AppContext = {
    bus: recordingBus(published),
    logger: memoryLogger(logs),
    mode,
  };
  return { app, published, logs };
}
