import { defineEvents, F } from 'dmg-core';
import * as v from 'valibot';

const ref = {
  questionnaireId: F.uuid('анкеты'),
  respondentId: F.uuid('респондента'),
  owner: v.pipe(
    v.record(v.string(), v.unknown()),
    v.description(
      'Данные владельца анкеты: их задаёт и толкует владелец, модуль анкет — нет',
    ),
  ),
};

/**
 * События анкеты — контракт внешнего модуля `questionnaire` (D-37).
 * Публикует legacy-агрегат анкеты; в DMG их доставляет карта `inbound`
 * (legacy `ownerInfo` → `owner`). При миграции модуля контракт остаётся.
 */
export const QuestionnaireEvents = defineEvents('questionnaire.questionnaire', {
  started: {
    label: 'Анкета запущена',
    description:
      'Анкета создана и показан первый вопрос. Legacy-событие несёт ещё ответ для UI — контракт его не включает.',
    payload: v.object(ref),
  },
  completed: {
    label: 'Анкета завершена',
    description: 'Респондент ответил на все вопросы анкеты.',
    payload: v.object(ref),
  },
  abandoned: {
    label: 'Анкета прервана',
    description:
      'Анкета закрыта без завершения: по таймауту простоя или самим респондентом.',
    payload: v.object({
      ...ref,
      reason: v.optional(
        F.picklist(
          ['timeout', 'by_user'],
          'Причина прерывания: таймаут простоя или решение респондента',
        ),
      ),
    }),
  },
});
