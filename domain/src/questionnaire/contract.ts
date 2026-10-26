/**
 * Контракт модуля questionnaire: паспорт внешнего модуля (D-37), Def UC для
 * других модулей (D-42; фасад — `Facade<typeof QuestionnaireModuleDef>`,
 * D-43), legacy-фасад, события, ошибки.
 */
export type { QuestionnaireFacade } from './facade';
export * from './questionnaire/errors';
export * from './questionnaire/events';
/**
 * Схема и тип пула анкеты — вход `StartQuestionnaireUcDef`. Нужны модулю
 * `wish`: он хранит пул анкеты курса и передаёт его в запуск анкеты.
 */
export {
  type QuestionnairePool,
  QuestionnairePoolSchema,
} from './questionnaire/question';
export { QuestionnaireEvents } from './questionnaire/questionnaire.events';
export { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';
export { QuestionnaireModuleDef } from './questionnaire.module';
