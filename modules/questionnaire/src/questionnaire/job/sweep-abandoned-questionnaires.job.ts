import {
  INVITE_AFTER_IDLE_MS,
  type QuestionnaireAr,
  type QuestionnaireModuleDef,
  SweepAbandonedQuestionnairesJobDef,
} from '@u7-scl/domain/questionnaire';
import { ok } from 'dmg-core';
import {
  JobFromDef,
  type JobReport,
  type JobRun,
  type UnitOfWork,
} from 'dmg-core/app';
import type { QuestionnaireDeps } from '../../questionnaire.module';

/**
 * Обход брошенных анкет: ступень простоя (приглашение, предупреждение,
 * закрытие) выбирает `QuestionnaireAr.sweepIdle`; Job отбирает записи и
 * фиксирует их. События уходят из UoW записи, адресата в них нет (D-63).
 */
export class SweepAbandonedQuestionnairesJob extends JobFromDef<
  typeof SweepAbandonedQuestionnairesJobDef,
  QuestionnaireDeps
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(SweepAbandonedQuestionnairesJobDef, deps, module);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    const idle = await this.resolve.questionnaires.findIdle({
      idleMs: INVITE_AFTER_IDLE_MS,
      at: this.now(),
      kinds: ['standard'],
    });
    return job.forEach(idle, (questionnaire, uow) =>
      this.sweep(questionnaire, uow),
    );
  }

  private async sweep(questionnaire: QuestionnaireAr, uow: UnitOfWork) {
    const at = this.now();
    if (!questionnaire.needsSweep(at)) return ok();
    const swept = questionnaire.sweepIdle(at);
    if (!swept.ok) return swept;
    uow.register(questionnaire, this.resolve.questionnaires);
    return ok();
  }
}
