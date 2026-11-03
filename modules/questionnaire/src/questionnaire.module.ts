// DMG-модуль внешнего контракта анкет — адаптеры над legacy-фасадом.
// субъект модуля — entity `User` до миграции анкет (`startStandard`).
import type { QuestionnaireFacade } from '@u7-scl/domain/questionnaire';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { User } from '@u7-scl/domain/user';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { StartQuestionnaireUc } from './questionnaire/uc/start-questionnaire.uc';

/** Что адаптеры над legacy-фасадом берут у legacy-фасада анкет. */
export type QuestionnaireLegacy = Pick<QuestionnaireFacade, 'startStandard'>;

/**
 * Резолвер DMG-модуля анкет: платформа + legacy-фасад. Своих
 * репозиториев нет — анкеты пишет legacy-модуль.
 */
export type QuestionnaireModuleDeps = ModuleDeps & {
  readonly legacy: QuestionnaireLegacy;
};

/**
 * Карта «Def → класс» внешнего модуля анкет (API-05, D-37): реализации —
 * адаптеры над legacy; ER и Job у внешнего модуля нет.
 */
export const questionnaireModuleMap = {
  useCases: { startQuestionnaire: StartQuestionnaireUc },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<
  typeof QuestionnaireModuleDef,
  QuestionnaireModuleDeps,
  User
>;

/**
 * DMG-модуль анкет — владелец UC внешнего контракта; фасад для других
 * модулей — `new ModuleFacade(createQuestionnaireModule(deps))` (D-43). Приложение
 * собирает его поверх legacy `QuestionnaireInProcFacade`.
 */
export function createQuestionnaireModule(deps: QuestionnaireModuleDeps) {
  return new ModuleFromDef<
    typeof QuestionnaireModuleDef,
    QuestionnaireModuleDeps,
    User
  >(QuestionnaireModuleDef, questionnaireModuleMap, deps);
}
