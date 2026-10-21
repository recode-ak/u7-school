import { allowAll, defineUseCase } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnairePoolSchema } from '../question';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';

/**
 * Запуск обычной анкеты — для других модулей (D-42). Респондент — субъект
 * вызывающего; `owner` — данные владельца анкеты (legacy `ownerInfo`):
 * модуль анкет их не толкует и возвращает в событиях.
 *
 * `allowAll`: legacy `start` прав не проверяет — анкета запускается только
 * за самого вызывающего, чужого респондента во входе нет.
 */
export const StartQuestionnaireUcDef = defineUseCase({
  name: 'startQuestionnaire',
  label: 'Запустить анкету',
  description:
    'Создаёт обычную анкету по пулу вопросов за вызывающего и показывает первый вопрос.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['module'],
  policy: allowAll,
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
