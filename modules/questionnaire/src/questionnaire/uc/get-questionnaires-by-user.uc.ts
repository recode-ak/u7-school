import {
  GetQuestionnairesByUserUcDef,
  type QuestionnaireModuleDef,
} from '@u7-scl/domain/questionnaire';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type {
  QuestionnaireDeps,
  QuestionnaireUser,
} from '../../questionnaire.module';

/** Загруженное — контекст Policy `canListFor`: чей список спрашивают. */
type Loaded = { readonly userId: string };

type Input = ParsedInputOf<typeof GetQuestionnairesByUserUcDef>;

/** `getQuestionnairesByUser`: анкеты респондента в порядке файла. */
export class GetQuestionnairesByUserUc extends UseCaseFromDef<
  typeof GetQuestionnairesByUserUcDef,
  QuestionnaireDeps,
  Loaded,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(GetQuestionnairesByUserUcDef, deps, module);
  }

  protected async load({ userId }: Input) {
    return ok({ userId });
  }

  protected async execute(
    { userId, status, kind, courseId }: Input,
    _: Loaded,
  ) {
    const questionnaires = await this.resolve.questionnaires.findByRespondent(
      userId,
      { status, kind, courseId },
    );
    return ok(questionnaires.map((questionnaire) => questionnaire.view()));
  }
}
