import { Job, type JobSchedule } from '#api/job/job';
import type { AnyJobDef } from '../../domain/contracts/define-job';
import type { ModuleDeps } from '../context';
import type { JobFromDef } from './job-from-def';

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
