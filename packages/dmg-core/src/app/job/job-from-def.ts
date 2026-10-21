import type { AnyJobDef } from '#core/domain/contracts/define-job';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import { SystemCaller } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { ok, type Result } from '#core/kernel/result/result';
import type { ModuleDeps } from '../context';
import { OperationFromDef } from '../operation/operation-from-def';
import type { OperationRun } from '../oplog/operation-run';
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
 * исключение, в production — `warn` в лог. Прогон — одна запись лога
 * операций: отчёт и события всех записей.
 */
export abstract class JobFromDef<
  D extends AnyJobDef,
  R extends ModuleDeps,
> extends OperationFromDef<D, R> {
  /** Вызывающий операций задания и его вызовов UC (`this.call`). */
  protected readonly caller: SystemCaller;

  /**
   * `module` — Def модуля-владельца (передаёт `ModuleFromDef`); Job не из
   * его `jobs` — исключение.
   */
  constructor(def: D, resolve: R, module: AnyModuleDef) {
    super(def, resolve, module, 'job');
    this.caller = new SystemCaller(this.ref);
  }

  protected abstract run(job: JobRun): Promise<JobReport>;

  /**
   * Один прогон со следом вызывающего (`jobTrace` — свой `runId`): след —
   * причина и `correlationId` всех его событий. Сбой вне записей
   * (загрузка) — `SERVER_INTERNAL` + лог.
   */
  handle(trace: Trace): Promise<Result<JobReport, DomainError>> {
    const call = { input: null, caller: this.caller, trace };
    return this.journal(call, (run) => {
      const job: JobRun = {
        trace,
        forEach: (items, step) => this.forEach(items, step, trace, run),
      };
      return runLogged(this.resolve.app, this.def.name, async () =>
        ok(await this.run(job)),
      );
    });
  }

  private async forEach<T>(
    items: readonly T[],
    step: Step<T>,
    trace: Trace,
    run: OperationRun,
  ): Promise<JobReport> {
    let failed = 0;
    for (const item of items) {
      const res = await runLogged(this.resolve.app, this.def.name, () =>
        this.commitStep(item, step, trace, run),
      );
      if (!res.ok) failed++;
    }
    return { processed: items.length - failed, failed };
  }

  private async commitStep<T>(
    item: T,
    step: Step<T>,
    trace: Trace,
    run: OperationRun,
  ): Promise<Result<void, DomainError>> {
    const uow = run.track(
      contractUnitOfWork(this.resolve.app, {
        source: this.def.name,
        trace,
        emits: this.def.emits,
        touches: this.def.scans,
      }),
    );
    const res = await step(item, uow);
    if (!res.ok) return res;
    const committed = await uow.commit();
    return committed.ok ? ok() : committed;
  }
}
