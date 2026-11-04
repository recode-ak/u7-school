import {
  HandleActionUcDef,
  type QuestionnaireAr,
  QuestionnaireErrors,
  type QuestionnaireModuleDef,
} from '@u7-scl/domain/questionnaire';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type {
  QuestionnaireDeps,
  QuestionnaireUser,
} from '../../questionnaire.module';

/** Загруженное — контекст Policy `canAccess`. */
type Loaded = { readonly questionnaire: QuestionnaireAr };

type Input = ParsedInputOf<typeof HandleActionUcDef>;

/** `handleAction`: ответ на текущий вопрос; исход (экран) решает агрегат. */
export class HandleActionUc extends UseCaseFromDef<
  typeof HandleActionUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(HandleActionUcDef, deps, module);
  }

  protected async load({ questionnaireId }: Input) {
    const questionnaire =
      await this.resolve.questionnaires.findById(questionnaireId);
    return questionnaire
      ? ok({ questionnaire })
      : QuestionnaireErrors.NOT_FOUND.err({ questionnaireId });
  }

  protected async execute(
    { type, value }: Input,
    { questionnaire }: Loaded,
    uow: UnitOfWork,
  ) {
    const answer = questionnaire.handleAction(this.now(), { type, value });
    if (!answer.ok) return answer;
    uow.register(questionnaire, this.resolve.questionnaires);
    return ok(answer.value);
  }
}
