import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnairePoolSchema } from '../question';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnairePolicy } from '../questionnaire.policy';

/** Запуск обычной анкеты за респондента: создаёт её сразу в работе. */
export const StartQuestionnaireUcDef = UseCaseDef.define({
  name: 'startQuestionnaire',
  label: 'Запустить анкету',
  description:
    'Создаёт обычную анкету сразу в работе и публикует started. Вызывается владельцем анкеты (wish, peer-review) за респондента.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['system'],
  policy: QuestionnairePolicy.rules.hasRespondent,
  input: v.object({
    pool: v.pipe(QuestionnairePoolSchema, v.description('Пул вопросов анкеты')),
    ownerInfo: F.sensitive(
      v.pipe(
        v.record(v.string(), v.unknown()),
        v.description(
          'Данные владельца анкеты: модуль анкет их не толкует и передаёт как есть',
        ),
      ),
    ),
  }),
  output: v.object({}),
  errors: [],
  emits: [QuestionnaireEvents.started],
});
