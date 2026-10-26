import type { AnyAggregateDef } from '#core/domain/aggregate/define-aggregate';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyEventDef,
  DomainEvent,
} from '#core/domain/events/define-events';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { ErrorOf } from '#core/kernel/errors/define-errors';
import { ok, type Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { Clock } from '../context';
import type { EventEnvelope, PublishedEvent } from '../events/event-envelope';
import type { Outbox } from '../events/outbox';
import { type Repository, VersionConflict } from './repository';

/** Что UoW нужно от агрегата: идентификатор, события, отметка записи. */
export type Committable = {
  readonly uuid: string;
  pullEvents(): readonly DomainEvent[];
  markStored(): void;
};

/** Ошибка фиксации: запись изменили параллельно. */
export type CommitError = ErrorOf<typeof CoreErrors.VERSION_CONFLICT>;

export type UnitOfWorkContext = {
  /** Куда уходят конверты записанных агрегатов (D-47). */
  readonly outbox: Outbox;
  readonly clock: Clock;
  readonly trace: Trace;
  /** Заявленные события операции; без поля проверка не выполняется. */
  readonly emits?: readonly AnyEventDef[];
  /**
   * Модуль операции: UoW меняет только его агрегаты (MAN-13, D-28); без
   * поля проверка не выполняется.
   */
  readonly module?: Pick<AnyModuleDef, 'name' | 'aggregates'>;
  /** Агрегаты, которые операции разрешено менять; без поля — любые. */
  readonly touches?: readonly AnyAggregateDef[];
  /** Что делать с расхождением с контрактом; по умолчанию — `throw`. */
  readonly onViolation?: (message: string) => void;
};

type Entry = { readonly ar: Committable; readonly save: () => Promise<void> };

/**
 * Единица работы одной операции (D-15): зарегистрированные агрегаты
 * сохраняются последовательно, затем их события уходят в outbox (D-47).
 * Отката нет — JSON-хранилище не атомарно; сбой сохранения отменяет
 * публикацию.
 */
export class UnitOfWork {
  private readonly entries: Entry[] = [];
  private readonly sent: PublishedEvent[] = [];

  constructor(private readonly ctx: UnitOfWorkContext) {}

  register<A extends Committable>(ar: A, repo: Repository<A>): void {
    this.assertOwnModule(repo.aggregate);
    this.assertTouches(repo.aggregate);
    if (this.entries.some((e) => e.ar === ar)) return;
    this.entries.push({ ar, save: () => repo.save(ar) });
  }

  /**
   * События собираются и сверяются с `emits` до записи: незаявленное
   * событие — баг реализации, и тогда не сохраняется ничего. Агрегаты
   * пишутся по порядку регистрации; в outbox одной партией уходят события
   * только записанных агрегатов — после записи всех или на первом сбое.
   * Сбой N-го агрегата (`VersionConflict` → `VERSION_CONFLICT`, иное
   * исключение — пробрасывается): записанные до него остаются (отката нет,
   * D-15) и их события уходят, события N-го и следующих — нет.
   *
   * `Ok` — опубликованные события (для лога операций). При отказе или
   * исключении опубликованное до сбоя видно в `published`. Сбой outbox —
   * исключение: записанное остаётся, опубликованным ничего не считается.
   * Если сбой outbox случился после исключения сохранения, пробрасывается
   * исходное исключение, а сбой outbox записывается в его `cause` (его
   * печатает `serializeError`). Если `cause` уже занят или исходное — не
   * `Error`, бросается `AggregateError` с обоими сбоями в `errors`.
   */
  async commit(): Promise<Result<readonly PublishedEvent[], CommitError>> {
    const batches = this.entries.map(({ ar }) =>
      ar.pullEvents().map((event) => this.envelope(event, ar.uuid)),
    );
    for (const envelope of batches.flat()) this.assertDeclared(envelope);
    let written = 0;
    try {
      for (const entry of this.entries) {
        await entry.save();
        entry.ar.markStored();
        written++;
      }
    } catch (error) {
      const stored = batches.slice(0, written).flat();
      if (!(error instanceof VersionConflict)) {
        await this.send(stored).catch((outboxError: unknown) => {
          throw withOutboxFailure(error, outboxError);
        });
        throw error;
      }
      await this.send(stored);
      return CoreErrors.VERSION_CONFLICT.err({
        aggregate: error.aggregate.name,
        uuid: error.uuid,
      });
    }
    await this.send(batches.flat());
    return ok(this.published);
  }

  /** События, опубликованные этой UoW (в том числе до сбоя фиксации). */
  get published(): readonly PublishedEvent[] {
    return [...this.sent];
  }

  private async send(envelopes: readonly EventEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;
    await this.ctx.outbox.put(envelopes);
    for (const { name, eventId } of envelopes)
      this.sent.push({ name, eventId });
  }

  private envelope(event: DomainEvent, aggregateId: string): EventEnvelope {
    return {
      ...event,
      eventId: crypto.randomUUID(),
      occurredAt: this.ctx.clock(),
      aggregateId,
      ...this.ctx.trace.toEnvelope(),
    };
  }

  private assertOwnModule(aggregate: AnyAggregateDef): void {
    const { module } = this.ctx;
    if (module === undefined || module.aggregates.includes(aggregate)) return;
    this.violate(
      `UoW: MAN-13: агрегат ${aggregate.name} не из модуля ${module.name}`,
    );
  }

  private assertTouches(aggregate: AnyAggregateDef): void {
    const { touches } = this.ctx;
    if (touches === undefined || touches.includes(aggregate)) return;
    this.violate(`UoW: агрегат ${aggregate.name} не заявлен в touches`);
  }

  private assertDeclared(envelope: EventEnvelope): void {
    const { emits } = this.ctx;
    if (emits === undefined || emits.some((d) => d.name === envelope.name)) {
      return;
    }
    this.violate(`UoW: событие ${envelope.name} не заявлено в emits`);
  }

  private violate(message: string): void {
    const { onViolation } = this.ctx;
    if (onViolation === undefined) throw new Error(message);
    onViolation(message);
  }
}

/**
 * Исходное исключение сохранения со сбоем outbox после него: сбой outbox —
 * в `cause`, если он свободен; иначе — `AggregateError` из обоих.
 */
function withOutboxFailure(error: unknown, outboxError: unknown): unknown {
  if (error instanceof Error && error.cause === undefined) {
    error.cause = outboxError;
    return error;
  }
  return new AggregateError(
    [error, outboxError],
    `UoW: сбой сохранения (${messageOf(error)}), затем сбой outbox (${messageOf(outboxError)})`,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
