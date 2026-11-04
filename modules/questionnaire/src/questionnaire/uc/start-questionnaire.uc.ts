import {
  QuestionnaireAr,
  type QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire';
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type {
  QuestionnaireDeps,
  QuestionnaireUser,
} from '../../questionnaire.module';

type Input = ParsedInputOf<typeof StartQuestionnaireUcDef>;

/**
 * `startQuestionnaire`: анкета создаётся сразу в работе за субъекта вызова —
 * владелец анкеты (`wish`, `peer-review`) передаёт пул и свои данные.
 */
export class StartQuestionnaireUc extends UseCaseFromDef<
  typeof StartQuestionnaireUcDef,
  QuestionnaireDeps,
  undefined,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(StartQuestionnaireUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    { pool, ownerInfo }: Input,
    _: undefined,
    uow: UnitOfWork,
    caller: Caller<QuestionnaireUser>,
  ) {
    const created = QuestionnaireAr.createStandard(
      {
        uuid: crypto.randomUUID(),
        respondentId: this.subject(caller).uuid,
        pool,
        ownerInfo,
      },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.questionnaires);
    return ok({});
  }
}
