import type { AnyJobDef } from '../../domain/contracts/define-job';
import { type SystemCaller, systemCaller } from '../../kernel/caller/caller';
import type { DomainError } from '../../kernel/errors/error';
import { ok, type Result } from '../../kernel/result/result';
import type { ModuleDeps } from '../context';
import { runLogged } from '../system/run-logged';
import { contractUnitOfWork } from '../uow/contract-unit-of-work';
import type { UnitOfWork } from '../uow/unit-of-work';

/** Итог прогона: сколько записей обработано и сколько сорвалось. */
export type JobReport = { readonly processed: number; readonly failed: number };

type Step<T> = (item: T, uow: UnitOfWork) => Promise<Result<void, DomainError>>;

/**
 * Реализация Job по Def (API-05). Наследник пишет `run`: загрузить записи и
 * пройти их через `forEach` — у каждой своя UoW, отказ или исключение
 * записи пишется в лог и не прерывает обход (API-06). Вызывающий —
 * `system` с источником = имя Job; регистрация агрегата вне `scans` —
 * исключение, в production — `warn` в лог.
 */
export abstract class JobFromDef<D extends AnyJobDef, R extends ModuleDeps> {
  protected readonly caller: SystemCaller<unknown>;

  constructor(
    readonly def: D,
    protected readonly resolve: R,
  ) {
    this.caller = systemCaller(def.name);
  }

  protected abstract run(): Promise<JobReport>;

  /** Один прогон; сбой вне записей (загрузка) — `SERVER_INTERNAL` + лог. */
  handle(): Promise<Result<JobReport, DomainError>> {
    return runLogged(this.resolve.app, this.def.name, async () =>
      ok(await this.run()),
    );
  }

  protected async forEach<T>(
    items: readonly T[],
    step: Step<T>,
  ): Promise<JobReport> {
    let failed = 0;
    for (const item of items) {
      const res = await runLogged(this.resolve.app, this.def.name, () =>
        this.commitStep(item, step),
      );
      if (!res.ok) failed++;
    }
    return { processed: items.length - failed, failed };
  }

  private async commitStep<T>(
    item: T,
    step: Step<T>,
  ): Promise<Result<void, DomainError>> {
    const uow = contractUnitOfWork(this.resolve.app, {
      source: this.def.name,
      caller: this.caller,
      emits: this.def.emits,
      touches: this.def.scans,
    });
    const res = await step(item, uow);
    if (!res.ok) return res;
    await uow.commit();
    return ok();
  }
}
