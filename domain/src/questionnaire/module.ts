/**
 * Метатипы API-модуля questionnaire для `U7BotAppMeta` и stories.
 * Резолвера и зависимостей рантайма здесь нет.
 */
import type { ApiModuleMeta } from '@u7-scl/core/domain';
import type { AbandonCmdMeta } from './questionnaire/commands/abandon-cmd';
import type { DeclineInviteCmdMeta } from './questionnaire/commands/decline-invite-cmd';
import type { GetCurrentCmdMeta } from './questionnaire/commands/get-current-cmd';
import type { GetQuestionnaireCmdMeta } from './questionnaire/commands/get-questionnaire-cmd';
import type { GetQuestionnairesByUserCmdMeta } from './questionnaire/commands/get-questionnaires-by-user-cmd';
import type { HandleActionCmdMeta } from './questionnaire/commands/handle-action-cmd';
import type { SendLikertInviteCmdMeta } from './questionnaire/commands/send-likert-invite-cmd';
import type { StartByInviteCmdMeta } from './questionnaire/commands/start-by-invite-cmd';
import type { StartCmdMeta } from './questionnaire/commands/start-cmd';

export type QuestionnaireUcMetas =
  | SendLikertInviteCmdMeta
  | StartCmdMeta
  | StartByInviteCmdMeta
  | DeclineInviteCmdMeta
  | HandleActionCmdMeta
  | AbandonCmdMeta
  | GetCurrentCmdMeta
  | GetQuestionnaireCmdMeta
  | GetQuestionnairesByUserCmdMeta;

/** Метаданные API-модуля questionnaire. */
export interface QuestionnaireApiModuleMeta extends ApiModuleMeta {
  name: 'questionnaire';
  url: '/questionnaire';
  ucMetas: QuestionnaireUcMetas;
}
