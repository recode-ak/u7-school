import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата анкеты (ERR-04). `NOT_INVITED` — один код для отказа
 * запуска и отказа от приглашения: текст общий для обеих операций.
 */
export const QuestionnaireErrors = ErrorDef.define('QUESTIONNAIRE', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Анкета не найдена',
    description: 'Анкеты с таким идентификатором нет.',
    payload: v.object({ questionnaireId: F.uuid('анкеты') }),
  },
  NOT_INVITED: {
    kind: 'conflict',
    label: 'Анкета не в статусе invited, невозможно запустить или отказаться',
    description: 'Запустить или отклонить можно только приглашённую анкету.',
  },
  NOT_IN_PROGRESS: {
    kind: 'conflict',
    label: 'Анкета уже завершена',
    description: 'Отвечать можно только на анкету в работе.',
  },
  NOT_ACTIVE: {
    kind: 'conflict',
    label: 'Анкета не активна',
    description: 'Прервать можно только приглашённую или заполняемую анкету.',
  },
  CHOICE_EXPECTED: {
    kind: 'validation',
    label: 'Ожидался ответ с выбором (нажатием кнопки)',
    description: 'Свободный текст не принимается на вопросе с выбором.',
  },
  EMPTY_ANSWER_CODE: {
    kind: 'validation',
    label: 'Код ответа не может быть пустым',
    description: 'Callback без кода ответа не принимается.',
  },
});
