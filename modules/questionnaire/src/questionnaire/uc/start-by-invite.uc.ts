import {
  type QuestionnaireAr,
  QuestionnaireErrors,
  type QuestionnaireModuleDef,
  StartByInviteUcDef,
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

type Input = ParsedInputOf<typeof StartByInviteUcDef>;

/** `startByInvite`: приглашённая анкета переходит в работу, `started` не публикуется. */
export class StartByInviteUc extends UseCaseFromDef<
  typeof StartByInviteUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(StartByInviteUcDef, deps, module);
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
    const started = questionnaire.start(this.now());
    if (!started.ok) return started;
    uow.register(questionnaire, this.resolve.questionnaires);
    return ok(questionnaire.screen());
  }
}
