import type { Caller, OperationRef } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import type { Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { Trace } from '#core/kernel/trace/trace';
import type { UnitOfWork } from '../uow/unit-of-work';
import type { OperationRecord } from './operation-record';

/** Кто и с чем вызвал операцию — постоянная часть записи лога. */
export type OperationCall = {
  readonly input: unknown;
  readonly caller: Caller;
  readonly trace: Trace;
};

/**
 * Один вызов операции для лога (D-43, Р6): момент начала, длительность и
 * UoW вызова (у Job — по одной на запись). События записи — опубликованные
 * всеми UoW, в том числе до сбоя фиксации.
 */
export class OperationRun {
  private readonly uows: UnitOfWork[] = [];
  private readonly started = performance.now();

  constructor(
    private readonly ref: OperationRef,
    private readonly at: Timestamp,
    private readonly call: OperationCall,
  ) {}

  /** UoW вызова — её события попадут в запись. */
  track(uow: UnitOfWork): UnitOfWork {
    this.uows.push(uow);
    return uow;
  }

  /** Запись по итогу вызова; `undefined` в выходе — `null` (JSON). */
  record(result: Result<unknown, DomainError>): OperationRecord {
    const { ref, at, call } = this;
    return {
      at,
      module: ref.module,
      op: ref.name,
      kind: ref.kind,
      caller: call.caller.toLog(),
      trace: call.trace,
      input: call.input ?? null,
      result: result.ok
        ? { ok: true, output: result.value ?? null }
        : { ok: false, error: result.error },
      events: this.uows.flatMap((uow) => uow.published),
      durationMs: performance.now() - this.started,
    };
  }
}
