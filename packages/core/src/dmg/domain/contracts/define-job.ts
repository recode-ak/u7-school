import type { JobSchedule } from '#api/job/job';
import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef } from '../events/define-events';

export type JobSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /** Расписание существующего планировщика (UTC). */
  readonly schedule: JobSchedule;
  /** Агрегаты, которые задание просматривает. */
  readonly scans?: readonly AnyAggregateDef[];
  readonly emits?: readonly AnyEventDef[];
};

export type JobDef<S extends JobSpec> = S &
  Required<Pick<JobSpec, 'scans' | 'emits'>> & { readonly dmg: 'job' };

export type AnyJobDef = JobDef<JobSpec>;

/** Контракт периодического задания. */
export function defineJob<const S extends JobSpec>(spec: S): JobDef<S> {
  return { scans: [], emits: [], ...spec, dmg: 'job' };
}
