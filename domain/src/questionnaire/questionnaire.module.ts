import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { SweepAbandonedQuestionnairesJobDef } from './questionnaire/job/sweep-abandoned-questionnaires.job';
import { QuestionnaireArDef } from './questionnaire/questionnaire.ar';
import { AbandonUcDef } from './questionnaire/uc/abandon.uc';
import { DeclineInviteUcDef } from './questionnaire/uc/decline-invite.uc';
import { GetCurrentUcDef } from './questionnaire/uc/get-current.uc';
import { GetQuestionnaireUcDef } from './questionnaire/uc/get-questionnaire.uc';
import { GetQuestionnairesByUserUcDef } from './questionnaire/uc/get-questionnaires-by-user.uc';
import { HandleActionUcDef } from './questionnaire/uc/handle-action.uc';
import { SendLikertInviteUcDef } from './questionnaire/uc/send-likert-invite.uc';
import { StartByInviteUcDef } from './questionnaire/uc/start-by-invite.uc';
import { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';

/** Паспорт модуля анкет: агрегат, 9 UC, обход брошенных анкет. */
export const QuestionnaireModuleDef = ModuleDef.define({
  name: 'questionnaire',
  label: 'Анкеты',
  description: 'Анкеты респондентов: запуск, заполнение, завершение.',
  dependsOn: [UserModuleDef],
  aggregates: [QuestionnaireArDef],
  useCases: [
    StartQuestionnaireUcDef,
    SendLikertInviteUcDef,
    StartByInviteUcDef,
    DeclineInviteUcDef,
    HandleActionUcDef,
    AbandonUcDef,
    GetQuestionnaireUcDef,
    GetCurrentUcDef,
    GetQuestionnairesByUserUcDef,
  ],
  reactions: [],
  jobs: [SweepAbandonedQuestionnairesJobDef],
});
