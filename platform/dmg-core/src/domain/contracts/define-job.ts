import { JobDef } from './job-def';
import type { JobSpec } from './job-def.types';
import type { SystemCalls } from './use-case-def.types';

export { JobDef } from './job-def';
export type { AnyJobDef, JobSchedule, JobSpec } from './job-def.types';

/**
 * Контракт периодического задания — обёртка над `JobDef.define` на время
 * перевода потребителей (трек dmg-core-oop, Фаза 7 удаляет).
 */
export function defineJob<const S extends JobSpec>(
  spec: S & SystemCalls<S>,
): JobDef<S> {
  return JobDef.define<S>(spec);
}
