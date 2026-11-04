import { JobDef } from 'dmg-core';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';

export {
  ABANDON_AFTER_HOURS,
  ABANDON_AFTER_IDLE_MS,
  INTERVAL_MS,
  INVITE_AFTER_HOURS,
  INVITE_AFTER_IDLE_MS,
  WARN_AFTER_HOURS,
  WARN_AFTER_IDLE_MS,
} from '../questionnaire.ar';

import { INTERVAL_MS } from '../questionnaire.ar';

/**
 * Обход брошенных анкет: приглашение продолжить (3 ч), предупреждение (6 ч)
 * и закрытие по таймауту (9 ч). Ступень выбирает `QuestionnaireAr.sweepIdle`.
 */
export const SweepAbandonedQuestionnairesJobDef = JobDef.define({
  name: 'sweepAbandonedQuestionnaires',
  label: 'Продолжение, предупреждение и закрытие брошенных анкет',
  description:
    'Раз в 3 часа обходит обычные анкеты без активности: приглашает продолжить, предупреждает о закрытии, закрывает по таймауту.',
  schedule: { kind: 'interval', intervalMs: INTERVAL_MS },
  scans: [QuestionnaireArDef],
  emits: [
    QuestionnaireEvents.continueInvite,
    QuestionnaireEvents.abandonWarning,
    QuestionnaireEvents.abandoned,
  ],
});
