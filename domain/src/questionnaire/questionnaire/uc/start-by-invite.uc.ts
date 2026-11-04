import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { QuestionnaireActionResponseSchema } from '../questionnaire.types';

/** Принятие приглашения: приглашённая анкета переходит в работу. */
export const StartByInviteUcDef = UseCaseDef.define({
  name: 'startByInvite',
  label: 'Начать анкету по приглашению',
  description:
    'Запускает приглашённую анкету и возвращает первый вопрос. События не публикует: started — только при создании.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
  }),
  output: QuestionnaireActionResponseSchema,
  errors: [QuestionnaireErrors.NOT_FOUND, QuestionnaireErrors.NOT_INVITED],
});
