import type { CallContext, OutputOf, Result, UseCaseErrorOf } from 'dmg-core';
import type { QuestionnairePool } from './questionnaire/question';
import type { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';

/**
 * Фасад модуля анкет по D-42 — рантайм-граница для других модулей: обычный
 * TS-тип, не Def. Каждый метод — обёртка над UC модуля: первый аргумент —
 * контекст вызова операции-потребителя, ошибки — ошибки UC.
 *
 * Имя — не `QuestionnaireFacade`: его занимает legacy-фасад (`facade.ts`)
 * до миграции модуля.
 */
export type QuestionnaireModuleFacade = {
  /** Запустить обычную анкету за вызывающего (UC `startQuestionnaire`). */
  startQuestionnaire(
    call: CallContext,
    pool: QuestionnairePool,
    owner: Readonly<Record<string, unknown>>,
  ): Promise<
    Result<
      OutputOf<typeof StartQuestionnaireUcDef>,
      UseCaseErrorOf<typeof StartQuestionnaireUcDef>
    >
  >;
};
