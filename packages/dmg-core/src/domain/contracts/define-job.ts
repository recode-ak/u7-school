import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef } from '../events/define-events';

/**
 * Расписание запуска, UTC. Структурно совпадает с legacy `JobSchedule`,
 * поэтому существующий планировщик принимает его без адаптера.
 */
export type JobSchedule =
  | {
      readonly kind: 'interval';
      readonly intervalMs: number;
      readonly alignUtc?: boolean;
      readonly runAtStart?: boolean;
    }
  | { readonly kind: 'dailyAt'; readonly hour: number; readonly minute: number }
  | {
      readonly kind: 'weeklyAt';
      readonly weekday: number;
      readonly hour: number;
      readonly minute: number;
    }
  | {
      readonly kind: 'monthlyAt';
      readonly day: number;
      readonly hour: number;
      readonly minute: number;
    };

export type JobSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
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
