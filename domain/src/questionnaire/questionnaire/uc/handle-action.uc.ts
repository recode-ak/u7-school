import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireErrors } from '../questionnaire.errors';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { QuestionnaireActionResponseSchema } from '../questionnaire.types';

/** Ответ на текущий вопрос анкеты: callback кнопки или свободный текст. */
export const HandleActionUcDef = UseCaseDef.define({
  name: 'handleAction',
  label: 'Обработать действие в анкете',
  description:
    'Фиксирует ответ, переключает черновик multiple-вопроса или завершает анкету событием completed.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canAccess,
  input: v.object({
    questionnaireId: v.pipe(F.uuid('анкеты'), v.description('Анкета')),
    type: v.pipe(
      v.picklist(['callback', 'text']),
      v.description('Вид действия: кнопка или свободный текст'),
    ),
    value: F.sensitive(
      v.pipe(v.string(), v.description('Код ответа или текст')),
    ),
  }),
  output: QuestionnaireActionResponseSchema,
  errors: [
    QuestionnaireErrors.NOT_FOUND,
    QuestionnaireErrors.NOT_IN_PROGRESS,
    QuestionnaireErrors.CHOICE_EXPECTED,
    QuestionnaireErrors.EMPTY_ANSWER_CODE,
  ],
  emits: [QuestionnaireEvents.completed],
});
