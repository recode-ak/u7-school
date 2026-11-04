import {
  AbandonUcDef,
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

type Input = ParsedInputOf<typeof AbandonUcDef>;

/** `abandon`: прерывание анкеты пользователем — причина `by_user`. */
export class AbandonUc extends UseCaseFromDef<
  typeof AbandonUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(AbandonUcDef, deps, module);
  }

  protected async load({ questionnaireId }: Input) {
    const questionnaire =
      await this.resolve.questionnaires.findById(questionnaireId);
    return questionnaire
      ? ok({ questionnaire })
      : QuestionnaireErrors.NOT_FOUND.err({ questionnaireId });
  }

  protected async execute(
    _: Input,
    { questionnaire }: Loaded,
    uow: UnitOfWork,
  ) {
    const abandoned = questionnaire.abandon(this.now(), 'by_user');
    if (!abandoned.ok) return abandoned;
    // Повтор на прерванной анкете — Ok без события: версия не выросла, писать нечего.
    if (questionnaire.version !== questionnaire.storedVersion) {
      uow.register(questionnaire, this.resolve.questionnaires);
    }
    return ok({});
  }
}
