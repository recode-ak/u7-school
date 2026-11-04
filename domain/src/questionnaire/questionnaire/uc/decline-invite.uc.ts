import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnairePolicy } from '../questionnaire.policy';

/** Отказ от приглашения: анкета прерывается с причиной `declined`. */
export const DeclineInviteUcDef = UseCaseDef.define({
  name: 'declineInvite',
  label: 'Отказаться от приглашения на анкету',
  description:
    'Прерывает приглашённую анкету с причиной by_user и публикует abandoned с reason declined.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
  }),
  output: v.object({}),
  errors: [QuestionnaireErrors.NOT_FOUND, QuestionnaireErrors.NOT_INVITED],
  emits: [QuestionnaireEvents.abandoned],
});
