import {
  QuestionnaireAr,
  type QuestionnaireModuleDef,
  SendLikertInviteUcDef,
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

type Input = ParsedInputOf<typeof SendLikertInviteUcDef>;

/**
 * `sendLikertInvite`: likert-анкета создаётся приглашённой — респондент
 * принимает приглашение или отказывается.
 */
export class SendLikertInviteUc extends UseCaseFromDef<
  typeof SendLikertInviteUcDef,
  QuestionnaireDeps,
  undefined,
  QuestionnaireUser
> {
  constructor(deps: QuestionnaireDeps, module: typeof QuestionnaireModuleDef) {
    super(SendLikertInviteUcDef, deps, module);
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
    const created = QuestionnaireAr.createLikert(
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
