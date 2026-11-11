import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire';
import type { UserAr } from '@u7-scl/domain/user/contract';
import type { ReadonlyAr } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { SweepAbandonedQuestionnairesJob } from './questionnaire/job/sweep-abandoned-questionnaires.job';
import type { QuestionnaireRepo } from './questionnaire/questionnaire.repo';
import { AbandonUc } from './questionnaire/uc/abandon.uc';
import { DeclineInviteUc } from './questionnaire/uc/decline-invite.uc';
import { GetCurrentUc } from './questionnaire/uc/get-current.uc';
import { GetQuestionnaireUc } from './questionnaire/uc/get-questionnaire.uc';
import { GetQuestionnairesByUserUc } from './questionnaire/uc/get-questionnaires-by-user.uc';
import { HandleActionUc } from './questionnaire/uc/handle-action.uc';
import { SendLikertInviteUc } from './questionnaire/uc/send-likert-invite.uc';
import { StartByInviteUc } from './questionnaire/uc/start-by-invite.uc';
import { StartQuestionnaireUc } from './questionnaire/uc/start-questionnaire.uc';

/** Субъект анкеты: права спрашиваются у `UserAr` (`QuestionnairePolicy`). */
export type QuestionnaireUser = ReadonlyAr<UserAr>;

/** Резолвер модуля анкет: платформа и репозиторий анкет. */
export type QuestionnaireDeps = ModuleDeps & {
  readonly questionnaires: QuestionnaireRepo;
};

/** Карта «Def → класс» модуля анкет (API-05); реакций нет, Job — обход брошенных. */
export const questionnaireMap = {
  useCases: {
    startQuestionnaire: StartQuestionnaireUc,
    sendLikertInvite: SendLikertInviteUc,
    startByInvite: StartByInviteUc,
    declineInvite: DeclineInviteUc,
    handleAction: HandleActionUc,
    abandon: AbandonUc,
    getQuestionnaire: GetQuestionnaireUc,
    getCurrent: GetCurrentUc,
    getQuestionnairesByUser: GetQuestionnairesByUserUc,
  },
  reactions: {},
  jobs: { sweepAbandonedQuestionnaires: SweepAbandonedQuestionnairesJob },
} satisfies ModuleMap<
  typeof QuestionnaireModuleDef,
  QuestionnaireDeps,
  QuestionnaireUser
>;

/** Модуль анкет: анкета на своём репозитории, запуск — по вызову владельца. */
export function createQuestionnaireModule(deps: QuestionnaireDeps) {
  return new ModuleFromDef<
    typeof QuestionnaireModuleDef,
    QuestionnaireDeps,
    QuestionnaireUser
  >(QuestionnaireModuleDef, questionnaireMap, deps);
}
