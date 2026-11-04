import {
  DeclineInviteUcDef,
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

type Input = ParsedInputOf<typeof DeclineInviteUcDef>;

/** `declineInvite`: отказ от приглашения — анкета прерывается с причиной `declined`. */
export class DeclineInviteUc extends UseCaseFromDef<
  typeof DeclineInviteUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(DeclineInviteUcDef, deps, module);
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
    const declined = questionnaire.decline(this.now());
    if (!declined.ok) return declined;
    uow.register(questionnaire, this.resolve.questionnaires);
    return ok({});
  }
}
