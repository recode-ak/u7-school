import type { AnyJobDef, AnyModuleDef, DomainError, Result } from 'dmg-core';
import { type JobReport, jobTrace, type Trace } from 'dmg-core/app';
import { Job, type JobSchedule } from '#api-legacy/job/job';

/**
 * Модуль DMG так, как его видит мост планировщика: Def и вход в его Job
 * (`ModuleFromDef` подходит как есть, D-43: модуль — единственная точка
 * входа).
 */
export type JobOwner<M extends AnyModuleDef> = {
  readonly def: M;
  runJob(
    def: M['jobs'][number],
    trace: Trace,
  ): Promise<Result<JobReport, DomainError>>;
};

/**
 * Job DMG в форме legacy `Job` — для существующего планировщика
 * (`InProcJobScheduler`): прогон — `module.runJob` со своим `runId`. Отказ
 * прогона бросается: планировщик пишет его в журнал прогонов как сбой.
 */
export function legacyJob<M extends AnyModuleDef>(
  module: JobOwner<M>,
  def: M['jobs'][number],
): Job {
  return new LegacyJob(module, def);
}

/** Задания модуля DMG в форме legacy — для `JobScheduler`. */
export function legacyJobsOf(module: JobOwner<AnyModuleDef>): Job[] {
  return module.def.jobs.map((def) => legacyJob(module, def));
}

class LegacyJob<M extends AnyModuleDef> extends Job {
  readonly jobName: string;
  readonly jobLabel: string;
  readonly schedule: JobSchedule;

  constructor(
    private readonly module: JobOwner<M>,
    private readonly def: AnyJobDef & M['jobs'][number],
  ) {
    super();
    this.jobName = def.name;
    this.jobLabel = def.label;
    this.schedule = def.schedule;
  }

  async execute(): Promise<void> {
    const res = await this.module.runJob(this.def, jobTrace());
    if (!res.ok) {
      throw new Error(`Job ${this.jobName}: ${res.error.code}`);
    }
  }
}
