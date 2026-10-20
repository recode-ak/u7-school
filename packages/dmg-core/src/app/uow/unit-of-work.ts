import type { AnyAggregateDef } from '#core/domain/aggregate/define-aggregate';
import type {
  AnyEventDef,
  DomainEvent,
} from '#core/domain/events/define-events';
import type { Caller } from '#core/kernel/caller/caller';
import type { Clock } from '../context';
import type { EventBus } from '../events/event-bus';
import type { EventEnvelope } from '../events/event-envelope';
import type { Trace } from '../trace';
import type { Repository } from './repository';

/** Что UoW нужно от агрегата: идентификатор и накопленные события. */
export type Committable = {
  readonly uuid: string;
  pullEvents(): readonly DomainEvent[];
};

export type UnitOfWorkContext = {
  readonly bus: EventBus;
  readonly clock: Clock;
  readonly caller: Caller<unknown>;
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

  constructor(private readonly ctx: UnitOfWorkContext) {}

  register<A extends Committable>(ar: A, repo: Repository<A>): void {
    this.assertTouches(repo.aggregate);
    if (this.entries.some((e) => e.ar === ar)) return;
    this.entries.push({ ar, save: () => repo.save(ar) });
  }

  /**
   * События собираются и сверяются с `emits` до записи: незаявленное
   * событие — баг реализации, и тогда не сохраняется ничего.
   */
  async commit(): Promise<void> {
    const envelopes = this.entries.flatMap(({ ar }) =>
      ar.pullEvents().map((event) => this.envelope(event, ar.uuid)),
    );
    for (const envelope of envelopes) this.assertDeclared(envelope);
    for (const entry of this.entries) await entry.save();
    for (const envelope of envelopes) this.ctx.bus.publish(envelope);
  }

  private envelope(event: DomainEvent, aggregateId: string): EventEnvelope {
    const { caller, trace } = this.ctx;
    return {
      ...event,
      eventId: crypto.randomUUID(),
      occurredAt: this.ctx.clock(),
      aggregateId,
      caller,
      cause: trace.cause,
      correlationId: trace.correlationId,
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
