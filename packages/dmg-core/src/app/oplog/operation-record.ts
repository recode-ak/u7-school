import type { CallerLog, OperationRef } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { Trace } from '#core/kernel/trace/trace';
import type { PublishedEvent } from '../events/event-envelope';

/**
 * Запись лога операций (D-43, Р6): один вызов UC, одна реакция ER или один
 * прогон Job — кто, по какой причине, с каким входом, чем закончился и
 * какие события опубликовал. Аудит «кто породил событие» — через запись
 * операции с этим `eventId`.
 */
export type OperationRecord = {
  /** Начало операции по часам приложения. */
  readonly at: Timestamp;
  readonly module: string;
  readonly op: string;
  readonly kind: OperationRef['kind'];
  readonly caller: CallerLog;
  readonly trace: Trace;
  /** Вход как пришёл: UC — до схемы, ER — событие, Job — `null`. */
  readonly input: unknown;
  readonly result:
    | { readonly ok: true; readonly output: unknown }
    | { readonly ok: false; readonly error: DomainError };
  readonly events: readonly PublishedEvent[];
  /** Длительность по монотонным часам процесса, мс. */
  readonly durationMs: number;
};

/**
 * Порт лога операций в `AppContext`. Пишет база операции
 * (`OperationFromDef`) последним шагом; сбой записи операцию не ломает.
 */
export interface OperationLog {
  append(record: OperationRecord): Promise<void>;
}
