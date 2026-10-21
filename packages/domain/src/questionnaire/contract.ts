/**
 * Контракт модуля questionnaire: паспорт внешнего модуля (D-37), Def UC для
 * других модулей и тип фасада (D-42), legacy-фасад, события, ошибки.
 */
export type { QuestionnaireFacade } from './facade';
export * from './questionnaire/errors';
export * from './questionnaire/events';
export { QuestionnaireEvents } from './questionnaire/questionnaire.events';
export { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';
export type { QuestionnaireModuleFacade } from './questionnaire.facade';
export { QuestionnaireModuleDef } from './questionnaire.module';
