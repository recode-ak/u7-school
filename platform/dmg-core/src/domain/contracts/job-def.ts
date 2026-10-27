import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { JobSpec, NormalizedJob } from './job-def.types';
import { OperationDef } from './operation-def';
import type { Declared } from './operation-def.types';
import type { SystemCalls } from './use-case-def.types';

export type {
  AnyJobDef,
  JobSchedule,
  JobSpec,
  NormalizedJob,
} from './job-def.types';

/**
 * Контракт периодического задания: расписание, просматриваемые агрегаты
 * `scans`, вызовы `calls` и публикуемые события. Необъявленные списки —
 * пустые кортежи из конструктора.
 */
export class JobDef<const S extends JobSpec = JobSpec> extends OperationDef<
  S['name']
> {
  declare readonly calls: Declared<S, 'calls'>;
  readonly dmg = 'job';
  readonly abbr = 'Job';
  readonly fileKind = 'job';
  readonly schedule: S['schedule'];
  readonly scans: Declared<S, 'scans'>;
  readonly emits: Declared<S, 'emits'>;

  constructor(spec: S) {
    super(spec);
    this.schedule = spec.schedule;
    this.scans = (spec.scans ?? []) as Declared<S, 'scans'>;
    this.emits = (spec.emits ?? []) as Declared<S, 'emits'>;
  }

  static define<const S extends JobSpec>(spec: S & SystemCalls<S>): JobDef<S> {
    return new JobDef<S>(spec);
  }

  aggregates(): readonly AnyAggregateDef[] {
    return this.scans;
  }

  normalize(): NormalizedJob {
    return {
      dmg: this.dmg,
      ...this.texts(),
      schedule: this.schedule,
      scans: this.scans.map((a) => a.name),
      calls: this.calls.map((u) => u.name),
      emits: this.emits.map((e) => e.name),
    };
  }
}
