import {
  InactivitySweepJobDef,
  type StreamModuleDef,
  type StudentAr,
} from '@u7-scl/domain/stream';
import { ok } from 'dmg-core';
import {
  JobFromDef,
  type JobReport,
  type JobRun,
  type UnitOfWork,
} from 'dmg-core/app';
import type { StreamDeps } from '../../stream.module';

/**
 * Обход учащихся: кому и когда слать уведомление, решает `StudentAr`; Job
 * отбирает записи и фиксирует маркеры. События уходят из UoW записи.
 */
export class InactivitySweepJob extends JobFromDef<
  typeof InactivitySweepJobDef,
  StreamDeps
> {
  constructor(deps: StreamDeps, module: typeof StreamModuleDef) {
    super(InactivitySweepJobDef, deps, module);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    const studying = await this.resolve.students.findStudying();
    return job.forEach(studying, (student, uow) => this.notice(student, uow));
  }

  private async notice(student: StudentAr, uow: UnitOfWork) {
    const at = this.now();
    if (!student.needsInactivityNotice(at)) return ok();
    const noticed = student.noticeInactivity(at);
    if (!noticed.ok) return noticed;
    uow.register(student, this.resolve.students);
    return ok();
  }
}
