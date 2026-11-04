import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnairePolicy } from '../questionnaire.policy';

/** Прерывание анкеты пользователем. */
export const AbandonUcDef = UseCaseDef.define({
  name: 'abandon',
  label: 'Прервать анкету',
  description:
    'Прерывает приглашённую или заполняемую анкету с причиной by_user; повтор на прерванной — без события.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
  }),
  output: v.object({}),
  errors: [QuestionnaireErrors.NOT_FOUND, QuestionnaireErrors.NOT_ACTIVE],
  emits: [QuestionnaireEvents.abandoned],
});
