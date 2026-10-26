import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventDef } from '../events/event-def';
import type {
  AnyUseCaseDef,
  DeclaredCalls,
  SystemCalls,
} from './define-use-case';

/**
 * Расписание запуска, UTC. Простая структура: планировщик приложения
 * (в том числе уже существующий) принимает её без адаптера.
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
  /** UC других модулей (с `'system'` в `callers`), которые задание вызывает через фасады (D-42, D-43). */
  readonly calls?: readonly AnyUseCaseDef[];
  readonly emits?: readonly AnyEventDef[];
};

export type JobDef<S extends JobSpec> = S &
  Required<Pick<JobSpec, 'scans' | 'emits'>> & {
    readonly calls: DeclaredCalls<S>;
    readonly dmg: 'job';
  };

export type AnyJobDef = JobDef<JobSpec>;

/** Контракт периодического задания. */
export function defineJob<const S extends JobSpec>(
  spec: S & SystemCalls<S>,
): JobDef<S> {
  return { scans: [], calls: [], emits: [], ...spec, dmg: 'job' };
}
