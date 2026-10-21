import type { AnyEventReactionDef } from '#core/domain/contracts/define-event-reaction';
import type { CallContext } from '#core/kernel/caller/call-context';
import { type SystemCaller, systemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import type { Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { EnvelopeOf } from '../events/event-envelope';
import { runLogged } from '../system/run-logged';
import type { Trace } from '../trace';
import { contractUnitOfWork } from '../uow/contract-unit-of-work';
import type { UnitOfWork } from '../uow/unit-of-work';

/** Конверт любого события, на которое подписана реакция. */
export type ReactionEnvelopeOf<D extends AnyEventReactionDef> = EnvelopeOf<
  D['on'][number]
>;

/**
 * Реализация ER по Def (API-05). Наследник пишет `react`: загрузить,
 * вызвать домен (или UC от имени `caller`), `uow.register`. Фиксацию после
 * `Ok`, лог отказа и перехват исключений делает база.
 *
 * Вызывающий — `system` с `onBehalfOf` автора события-причины (caller.md
 * §2 п. 5). След: причина — событие, `correlationId` — его же; `trace`
 * передаётся в `react`, чтобы вызванный UC продолжил цепочку. Регистрация
 * агрегата вне `touches` — исключение, в production — `warn` в лог; вызов
 * UC другого модуля вне `calls` отклоняет сам вызываемый UC (D-42).
 */
export abstract class ReactionFromDef<
  D extends AnyEventReactionDef,
  R extends ModuleDeps,
> {
  constructor(
    readonly def: D,
    protected readonly resolve: R,
  ) {}

  protected abstract react(
    event: ReactionEnvelopeOf<D>,
    uow: UnitOfWork,
    caller: SystemCaller<unknown>,
    trace: Trace,
  ): Promise<Result<void, DomainError>>;

  /**
   * Контекст вызова фасада другого модуля (D-42): эта реакция — `from`,
   * вызывающий и след — те, что получил `react`.
   */
  protected callContext(
    caller: SystemCaller<unknown>,
    trace: Trace,
  ): CallContext {
    return { from: this.def, caller, trace };
  }

  /** Текущий момент по часам приложения — передаётся в операции домена. */
  protected now(): Timestamp {
    return this.resolve.app.clock();
  }

  handle(event: ReactionEnvelopeOf<D>): Promise<Result<void, DomainError>> {
    const { app } = this.resolve;
    return runLogged(app, this.def.name, async () => {
      const caller = systemCaller(this.def.name, event.caller);
      const trace: Trace = {
        cause: { kind: 'event', eventId: event.eventId },
        correlationId: event.correlationId,
      };
      const uow = contractUnitOfWork(app, {
        source: this.def.name,
        caller,
        trace,
        emits: this.def.emits,
        touches: this.def.touches,
      });
      const res = await this.react(event, uow, caller, trace);
      if (!res.ok) return res;
      return uow.commit();
    });
  }

  /** Подписка на все события `on`; возвращает отписку. */
  subscribe(bus: EventBus): () => void {
    // Аннотация сохраняет тип элемента: `.map` по дженерику `D['on']`
    // расширил бы его до ограничения `AnyEventDef`.
    const on: readonly D['on'][number][] = this.def.on;
    const offs = on.map((def) =>
      bus.subscribe(def, async (event) => {
        await this.handle(event);
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }
}
