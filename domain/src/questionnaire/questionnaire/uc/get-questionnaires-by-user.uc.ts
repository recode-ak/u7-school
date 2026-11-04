import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { QuestionnaireView } from '../questionnaire.state';

/** Список анкет пользователя. */
export const GetQuestionnairesByUserUcDef = UseCaseDef.define({
  name: 'getQuestionnairesByUser',
  label: 'Получить анкеты пользователя',
  description:
    'Возвращает анкеты респондента. Свой список читает сам пользователь, чужой — администратор.',
  type: 'query',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canListFor,
  input: v.object({
    userId: v.pipe(F.uuid('пользователя'), v.description('Респондент')),
  }),
  output: v.pipe(
    v.array(QuestionnaireView),
    v.description('Анкеты пользователя'),
  ),
  errors: [],
});
