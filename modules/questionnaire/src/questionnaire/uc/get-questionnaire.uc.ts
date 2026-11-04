import {
  GetQuestionnaireUcDef,
  type QuestionnaireAr,
  QuestionnaireErrors,
  type QuestionnaireModuleDef,
} from '@u7-scl/domain/questionnaire';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type {
  QuestionnaireDeps,
  QuestionnaireUser,
} from '../../questionnaire.module';

/** Загруженное — контекст Policy `canAccess`. */
type Loaded = { readonly questionnaire: QuestionnaireAr };

type Input = ParsedInputOf<typeof GetQuestionnaireUcDef>;

/** `getQuestionnaire`: анкета целиком, даты числами (DOM-17). */
export class GetQuestionnaireUc extends UseCaseFromDef<
  typeof GetQuestionnaireUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(GetQuestionnaireUcDef, deps, module);
  }

  protected async load({ questionnaireId }: Input) {
    const questionnaire =
      await this.resolve.questionnaires.findById(questionnaireId);
    return questionnaire
      ? ok({ questionnaire })
      : QuestionnaireErrors.NOT_FOUND.err({ questionnaireId });
  }

  protected async execute(_: Input, { questionnaire }: Loaded) {
    return ok(questionnaire.view());
  }
}
