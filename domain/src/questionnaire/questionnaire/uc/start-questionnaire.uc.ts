import { UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnairePoolSchema } from '../question';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnaireRespondentPolicy } from '../questionnaire-respondent.policy';

/**
 * Запуск обычной анкеты — для других модулей (D-42). Респондент — субъект
 * вызывающего; `owner` — данные владельца анкеты (legacy `ownerInfo`):
 * модуль анкет их не толкует и возвращает в событиях.
 *
 * Policy: респондент есть (`hasRespondent`) — анкета запускается только за
 * самого вызывающего, чужого респондента во входе нет; системный вызов без
 * человека получает `ACCESS_DENIED`.
 */
export const StartQuestionnaireUcDef = UseCaseDef.define({
  name: 'startQuestionnaire',
  label: 'Запустить анкету',
  description:
    'Создаёт обычную анкету по пулу вопросов за вызывающего и показывает первый вопрос.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['system'],
  policy: QuestionnaireRespondentPolicy.rules.hasRespondent,
  input: v.object({
    pool: v.pipe(
      QuestionnairePoolSchema,
      v.description('Пул анкеты: тексты и вопросы'),
    ),
    owner: QuestionnaireEvents.started.payload.entries.owner,
  }),
  output: v.object({}),
  errors: [],
  emits: [QuestionnaireEvents.started],
});
