import type { AnyEventReactionDef } from '#core/domain/contracts/define-event-reaction';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import { SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { EnvelopeOf } from '../events/event-envelope';
import { OperationFromDef } from '../operation/operation-from-def';
import { runLogged } from '../system/run-logged';
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
 * Вызывающий — `SystemCaller` этой реакции без человека: субъекта нет,
 * «кто породил» — через `trace.cause` (caller.md §1). След: причина — событие, `correlationId` — его же; `trace`
 * передаётся в `react`, чтобы вызванный UC продолжил цепочку. Регистрация
 * агрегата вне `touches` — исключение, в production — `warn` в лог; UC
 * другого модуля — `this.call` только из `calls` (тип, D-43).
 */
export abstract class ReactionFromDef<
  D extends AnyEventReactionDef,
  R extends ModuleDeps,
> extends OperationFromDef<D, R> {
  /**
   * `module` — Def модуля-владельца (передаёт `ModuleFromDef`); ER не из
   * его `reactions` — исключение.
   */
  constructor(def: D, resolve: R, module: AnyModuleDef) {
    super(def, resolve, module, 'eventReaction');
  }

  protected abstract react(
    event: ReactionEnvelopeOf<D>,
    uow: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<void, DomainError>>;

  /**
   * Реакция на событие и запись в лог операций (вход — событие; «кто
   * породил» — в записи породившей операции, D-43).
   *
   * Доставка — через `app.inbox` (D-47): повтор того же `eventId` этой
   * реакции отбрасывается (`Ok`, без записи в лог операций, `debug` в
   * логгер). После отказа или исключения доставка снимается — повтор того
   * же события исполнится снова.
   */
  async handle(
    event: ReactionEnvelopeOf<D>,
  ): Promise<Result<void, DomainError>> {
    const { app } = this.resolve;
    const delivery = { reaction: this.ref, eventId: event.eventId };
    if (!(await app.inbox.claim(delivery))) {
      app.logger.debug(
        this.def.name,
        `Повтор доставки ${event.eventId} отброшен`,
      );
      return ok();
    }
    const res = await this.execute(event);
    if (!res.ok) await app.inbox.release(delivery);
    return res;
  }

  private execute(
    event: ReactionEnvelopeOf<D>,
  ): Promise<Result<void, DomainError>> {
    const { app } = this.resolve;
    const caller = new SystemCaller(this.ref);
    const trace = Trace.fromEvent(event);
    return this.journal({ input: event, caller, trace }, (run) =>
      runLogged(app, this.def.name, async () => {
        const uow = run.track(this.createUow(trace));
        const res = await this.react(event, uow, caller, trace);
        if (!res.ok) return res;
        const committed = await uow.commit();
        return committed.ok ? ok() : committed;
      }),
    );
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
