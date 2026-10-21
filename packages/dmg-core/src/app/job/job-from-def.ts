import type { AnyJobDef } from '#core/domain/contracts/define-job';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type { CallContext } from '#core/kernel/caller/call-context';
import { type OperationRef, SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { ModuleDeps } from '../context';
import { runLogged } from '../system/run-logged';
import type { Trace } from '../trace';
import { contractUnitOfWork } from '../uow/contract-unit-of-work';
import type { UnitOfWork } from '../uow/unit-of-work';

/** Итог прогона: сколько записей обработано и сколько сорвалось. */
export type JobReport = { readonly processed: number; readonly failed: number };

type Step<T> = (item: T, uow: UnitOfWork) => Promise<Result<void, DomainError>>;

/** Прогон Job: его след и обход записей (своя UoW на запись, API-06). */
export type JobRun = {
  readonly trace: Trace;
  forEach<T>(items: readonly T[], step: Step<T>): Promise<JobReport>;
};

/**
 * Реализация Job по Def (API-05). Наследник пишет `run`: загрузить записи и
 * пройти их через `job.forEach` — у каждой своя UoW, отказ или исключение
 * записи пишется в лог и не прерывает обход (API-06). Вызывающий —
 * `SystemCaller` этого Job без человека; регистрация агрегата вне `scans` —
 * исключение, в production — `warn` в лог.
 */
export abstract class JobFromDef<D extends AnyJobDef, R extends ModuleDeps> {
  /** Это задание — `from` его вызывающего (D-43). */
  readonly ref: OperationRef;
  protected readonly caller: SystemCaller;

  /** `module` — Def модуля-владельца; Job не из его `jobs` — исключение. */
  constructor(
    readonly def: D,
    protected readonly resolve: R,
    module: AnyModuleDef,
  ) {
    if (!module.jobs.includes(def)) {
      throw new Error(`Job ${def.name} не входит в модуль ${module.name}`);
    }
    this.ref = { kind: 'job', module: module.name, name: def.name };
    this.caller = new SystemCaller(this.ref);
  }

  protected abstract run(job: JobRun): Promise<JobReport>;

  /**
   * Контекст вызова фасада другого модуля (D-42): вызывающий — его
   * `SystemCaller`, след — прогона (`job.trace`).
   */
  protected callContext(trace: Trace): CallContext {
    return { caller: this.caller, calls: this.def.calls, trace };
  }

  /** Текущий момент по часам приложения — передаётся в операции домена. */
  protected now(): Timestamp {
    return this.resolve.app.clock();
  }

  /**
   * Один прогон со следом вызывающего (`jobTrace` — свой `runId`): след —
   * причина и `correlationId` всех его событий. Сбой вне записей
   * (загрузка) — `SERVER_INTERNAL` + лог.
   */
  handle(trace: Trace): Promise<Result<JobReport, DomainError>> {
    const job: JobRun = {
      trace,
      forEach: (items, step) => this.forEach(items, step, trace),
    };
    return runLogged(this.resolve.app, this.def.name, async () =>
      ok(await this.run(job)),
    );
  }

  private async forEach<T>(
    items: readonly T[],
    step: Step<T>,
    trace: Trace,
  ): Promise<JobReport> {
    let failed = 0;
    for (const item of items) {
      const res = await runLogged(this.resolve.app, this.def.name, () =>
        this.commitStep(item, step, trace),
      );
      if (!res.ok) failed++;
    }
    return { processed: items.length - failed, failed };
  }

  private async commitStep<T>(
    item: T,
    step: Step<T>,
    trace: Trace,
  ): Promise<Result<void, DomainError>> {
    const uow = contractUnitOfWork(this.resolve.app, {
      source: this.def.name,
      caller: this.caller,
      trace,
      emits: this.def.emits,
      touches: this.def.scans,
    });
    const res = await step(item, uow);
    if (!res.ok) return res;
    return uow.commit();
  }
}
