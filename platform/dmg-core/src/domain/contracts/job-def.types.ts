import type { DefTexts } from '#core/kernel/def/def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventDef } from '../events/event-def';
import type { JobDef } from './job-def';
import type { OperationSpec } from './operation-def.types';

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

/** Контракт периодического задания. */
export type JobSpec = OperationSpec & {
  readonly schedule: JobSchedule;
  /** Агрегаты, которые задание просматривает. */
  readonly scans?: readonly AnyAggregateDef[];
  readonly emits?: readonly AnyEventDef[];
};

/** Любой Def Job — структурный тип публичных членов (как `AnyUseCaseDef`). */
export type AnyJobDef = { readonly [K in keyof JobDef]: JobDef[K] };

/** Сериализуемая форма Job. */
export type NormalizedJob = DefTexts & {
  readonly dmg: 'job';
  readonly schedule: JobSchedule;
  readonly scans: readonly string[];
  /** Имена UC других модулей, которые задание вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};
