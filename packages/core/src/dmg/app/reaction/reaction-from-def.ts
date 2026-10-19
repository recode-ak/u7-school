import type { AnyEventReactionDef } from '../../domain/contracts/define-event-reaction';
import { type SystemCaller, systemCaller } from '../../kernel/caller/caller';
import type { DomainError } from '../../kernel/errors/error';
import { ok, type Result } from '../../kernel/result/result';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { EnvelopeOf } from '../events/event-envelope';
import { guardCalls } from '../facade/guard-calls';
import { runLogged } from '../system/run-logged';
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
 * §2 п. 5); `causationId` событий реакции — `eventId` причины. Вне
 * production обращение к фасаду вне `calls` и регистрация агрегата вне
 * `touches` — исключение.
 */
export abstract class ReactionFromDef<
  D extends AnyEventReactionDef,
  R extends ModuleDeps,
> {
  protected readonly resolve: R;

  constructor(
    readonly def: D,
    resolve: R,
  ) {
    this.resolve =
      resolve.app.mode === 'production'
        ? resolve
        : guardCalls(def.name, def.calls, resolve);
  }

  protected abstract react(
    event: ReactionEnvelopeOf<D>,
    uow: UnitOfWork,
    caller: SystemCaller<unknown>,
  ): Promise<Result<void, DomainError>>;

  handle(event: ReactionEnvelopeOf<D>): Promise<Result<void, DomainError>> {
    const { app } = this.resolve;
    return runLogged(app, this.def.name, async () => {
      const caller = systemCaller(this.def.name, event.caller);
      const uow = contractUnitOfWork(app, {
        caller,
        causationId: event.eventId,
        emits: this.def.emits,
        touches: this.def.touches,
      });
      const res = await this.react(event, uow, caller);
      if (!res.ok) return res;
      await uow.commit();
      return ok();
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
