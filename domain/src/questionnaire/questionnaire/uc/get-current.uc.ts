import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { QuestionnaireActionResponseSchema } from '../questionnaire.types';

/** Текущий экран анкеты: приглашение, вопрос или завершение. */
export const GetCurrentUcDef = UseCaseDef.define({
  name: 'getCurrent',
  label: 'Получить текущий экран анкеты',
  description:
    'Возвращает экран, который видит респондент: приглашение, текущий вопрос или завершение.',
  type: 'query',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
  }),
  output: QuestionnaireActionResponseSchema,
  errors: [QuestionnaireErrors.NOT_FOUND],
});
