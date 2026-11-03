// TR-11: адаптер UC внешнего контракта над legacy-фасадом анкет.
// субъект вызывающего — entity `User`: его ждёт legacy `startStandard`;
// уйдёт при миграции модуля анкет.
import {
  type QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import type { User } from '@u7-scl/domain/user';
import { type Caller, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { QuestionnaireModuleDeps } from '../../questionnaire.module';

/**
 * Временная реализация `startQuestionnaire` (TR-11): анкету создаёт,
 * сохраняет и публикует `questionnaire:start` legacy-модуль (D-37);
 * `owner` контракта — legacy `ownerInfo`. Через UoW адаптер ничего не
 * пишет: `emits` Def описывает событие legacy-кода.
 */
export class StartQuestionnaireUc extends UseCaseFromDef<
  typeof StartQuestionnaireUcDef,
  QuestionnaireModuleDeps,
  undefined,
  User
> {
  constructor(
    deps: QuestionnaireModuleDeps,
    module: typeof QuestionnaireModuleDef,
  ) {
    super(StartQuestionnaireUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  /** Респондент — субъект исходного человека (`SystemCaller.person()`). */
  protected async execute(
    { pool, owner }: ParsedInputOf<typeof StartQuestionnaireUcDef>,
    _: undefined,
    __: unknown,
    caller: Caller<User>,
  ) {
    await this.resolve.legacy.startStandard(this.subject(caller), pool, owner);
    return ok({});
  }
}
