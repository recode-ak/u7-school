import type { AnyAggregateDef } from '#core/domain/aggregate/define-aggregate';
import type {
  AnyEventDef,
  DomainEvent,
} from '#core/domain/events/define-events';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { ErrorOf } from '#core/kernel/errors/define-errors';
import { ok, type Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { Clock } from '../context';
import type { EventBus } from '../events/event-bus';
import type { EventEnvelope, PublishedEvent } from '../events/event-envelope';
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
  readonly bus: EventBus;
  readonly clock: Clock;
  readonly trace: Trace;
  /** Заявленные события операции; без поля проверка не выполняется. */
  readonly emits?: readonly AnyEventDef[];
  /** Агрегаты, которые операции разрешено менять; без поля — любые. */
  readonly touches?: readonly AnyAggregateDef[];
  /** Что делать с расхождением с контрактом; по умолчанию — `throw`. */
  readonly onViolation?: (message: string) => void;
};

type Entry = { readonly ar: Committable; readonly save: () => Promise<void> };

/**
 * Единица работы одной операции (D-15): зарегистрированные агрегаты
 * сохраняются последовательно, затем публикуются их события. Отката нет —
 * JSON-хранилище не атомарно; сбой сохранения отменяет публикацию.
 */
export class UnitOfWork {
  private readonly entries: Entry[] = [];
  private readonly sent: PublishedEvent[] = [];

  constructor(private readonly ctx: UnitOfWorkContext) {}

  register<A extends Committable>(ar: A, repo: Repository<A>): void {
    this.assertTouches(repo.aggregate);
    if (this.entries.some((e) => e.ar === ar)) return;
    this.entries.push({ ar, save: () => repo.save(ar) });
  }

  /**
   * События собираются и сверяются с `emits` до записи: незаявленное
   * событие — баг реализации, и тогда не сохраняется ничего. Агрегаты
   * пишутся по порядку регистрации; публикуются события только записанных
   * агрегатов — после записи всех или на первом сбое. Сбой N-го агрегата
   * (`VersionConflict` → `VERSION_CONFLICT`, иное исключение — пробрасывается):
   * записанные до него остаются (отката нет, D-15) и их события уходят,
   * события N-го и следующих — нет.
   *
   * `Ok` — опубликованные события (для лога операций). При отказе или
   * исключении опубликованное до сбоя видно в `published`.
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
      if (!(error instanceof VersionConflict)) throw error;
      return CoreErrors.VERSION_CONFLICT.err({
        aggregate: error.aggregate.name,
        uuid: error.uuid,
      });
    } finally {
      for (const envelope of batches.slice(0, written).flat()) {
        this.ctx.bus.publish(envelope);
        this.sent.push({ name: envelope.name, eventId: envelope.eventId });
      }
    }
    return ok(this.published);
  }

  /** События, опубликованные этой UoW (в том числе до сбоя фиксации). */
  get published(): readonly PublishedEvent[] {
    return [...this.sent];
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
