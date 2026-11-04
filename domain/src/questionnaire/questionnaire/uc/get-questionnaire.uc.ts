import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { QuestionnaireView } from '../questionnaire.state';

/** Анкета целиком: состояние с числовыми датами (DOM-17). */
export const GetQuestionnaireUcDef = UseCaseDef.define({
  name: 'getQuestionnaire',
  label: 'Получить анкету',
  description:
    'Возвращает анкету с ответами и состоянием. Читает респондент или администратор.',
  type: 'query',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
  }),
  output: QuestionnaireView,
  errors: [QuestionnaireErrors.NOT_FOUND],
});
