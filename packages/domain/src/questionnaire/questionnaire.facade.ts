import type {
  CallContext,
  InputOf,
  OutputOf,
  Result,
  UseCaseErrorOf,
} from 'dmg-core';
import type { StartQuestionnaireUcDef } from './questionnaire/uc/start-questionnaire.uc';

/** Вход UC запуска анкеты — источник типов аргументов фасада. */
type StartQuestionnaireInput = InputOf<typeof StartQuestionnaireUcDef>;

/**
 * Фасад модуля анкет по D-42 — рантайм-граница для других модулей: обычный
 * TS-тип, не Def. Каждый метод — обёртка над UC модуля: первый аргумент —
 * контекст вызова операции-потребителя, остальные — поля входа UC (типы
 * выводятся из Def), ошибки — ошибки UC.
 *
 * Имя — не `QuestionnaireFacade`: его занимает legacy-фасад (`facade.ts`)
 * до миграции модуля.
 */
export type QuestionnaireModuleFacade = {
  /** Запустить обычную анкету за вызывающего (UC `startQuestionnaire`). */
  startQuestionnaire(
    call: CallContext,
    pool: StartQuestionnaireInput['pool'],
    owner: StartQuestionnaireInput['owner'],
  ): Promise<
    Result<
      OutputOf<typeof StartQuestionnaireUcDef>,
      UseCaseErrorOf<typeof StartQuestionnaireUcDef>
    >
  >;
};
