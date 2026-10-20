/** Контракт модуля questionnaire: паспорт внешнего модуля (D-37), фасад, события, ошибки. */
export type { QuestionnaireFacade } from './facade';
export * from './questionnaire/errors';
export * from './questionnaire/events';
export { QuestionnaireEvents } from './questionnaire/questionnaire.events';
export { QuestionnaireModuleDef } from './questionnaire.module';
