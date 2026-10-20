import { Job, type JobSchedule } from '#api-legacy/job/job';
import type { AnyJobDef, JobFromDef, ModuleDeps } from '#dmg/index';

/**
 * Job DMG в форме legacy `Job` — для существующего планировщика
 * (`InProcJobScheduler`). Отказ прогона бросается: планировщик пишет его
 * в журнал прогонов как сбой.
 */
export function legacyJob<D extends AnyJobDef>(
  job: JobFromDef<D, ModuleDeps>,
): Job {
  return new LegacyJob(job);
}

/** Задания модуля DMG в форме legacy — для `JobScheduler`. */
export function legacyJobsOf(module: {
  readonly jobs: readonly JobFromDef<AnyJobDef, ModuleDeps>[];
}): Job[] {
  return module.jobs.map(legacyJob);
}

class LegacyJob<D extends AnyJobDef> extends Job {
  readonly jobName: string;
  readonly jobLabel: string;
  readonly schedule: JobSchedule;

  constructor(private readonly job: JobFromDef<D, ModuleDeps>) {
    super();
    this.jobName = job.def.name;
    this.jobLabel = job.def.label;
    this.schedule = job.def.schedule;
  }

  async execute(): Promise<void> {
    const res = await this.job.handle();
    if (!res.ok) {
      throw new Error(`Job ${this.jobName}: ${res.error.code}`);
    }
  }
}
