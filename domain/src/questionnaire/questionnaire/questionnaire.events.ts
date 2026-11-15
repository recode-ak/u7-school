import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';
import { LikertScoreSchema } from './likert/likert-question';

const kind = F.picklist(['standard', 'likert'], 'вида анкеты');

const ownerInfo = F.sensitive(
  v.pipe(
    v.record(v.string(), v.unknown()),
    v.description(
      'Данные владельца анкеты: модуль анкет их не толкует и передаёт как есть',
    ),
  ),
);

/**
 * События анкеты. `ownerInfo` — данные владельца: модуль анкет их не
 * толкует, адресата и текст уведомления определяет потребитель (бот).
 */
export const QuestionnaireEvents = EventDef.define(
  'questionnaire.questionnaire',
  {
    started: {
      label: 'Анкета запущена',
      description:
        'Анкета создана сразу в работе: респондент начинает заполнение с первого вопроса.',
      payload: v.object({
        questionnaireId: F.uuid('анкеты'),
        respondentId: F.uuid('респондента'),
        kind,
        ownerInfo,
      }),
    },
    invited: {
      label: 'Респондент приглашён пройти анкету',
      description:
        'Создана анкета-приглашение (likert): респондент принимает приглашение или отказывается.',
      payload: v.object({
        questionnaireId: F.uuid('анкеты'),
        respondentId: F.uuid('респондента'),
        kind,
        ownerInfo,
      }),
    },
    completed: {
      label: 'Анкета завершена',
      description:
        'Респондент ответил на последний вопрос. У likert с событием идут баллы по подкатегориям.',
      payload: v.variant('kind', [
        v.object({
          questionnaireId: F.uuid('анкеты'),
          respondentId: F.uuid('респондента'),
          kind: v.pipe(v.literal('standard'), v.description('Вид анкеты')),
          ownerInfo,
        }),
        v.object({
          questionnaireId: F.uuid('анкеты'),
          respondentId: F.uuid('респондента'),
          kind: v.pipe(v.literal('likert'), v.description('Вид анкеты')),
          ownerInfo,
          likertScores: v.pipe(
            v.array(LikertScoreSchema),
            v.description('Баллы по подкатегориям likert-анкеты'),
          ),
        }),
      ]),
    },
    abandoned: {
      label: 'Анкета прервана',
      description:
        'Анкета прервана: пользователем, отказом от приглашения или по простою (timeout).',
      payload: v.object({
        questionnaireId: F.uuid('анкеты'),
        respondentId: F.uuid('респондента'),
        kind,
        ownerInfo,
        reason: F.picklist(
          ['timeout', 'by_user', 'declined'],
          'причины прерывания',
        ),
      }),
    },
    abandonWarning: {
      label: 'Анкета приостановлена',
      description:
        'Анкета простаивает 6 часов: респонденту отправляется предупреждение о закрытии.',
      payload: v.object({
        questionnaireId: F.uuid('анкеты'),
        respondentId: F.uuid('респондента'),
        kind,
        ownerInfo,
      }),
    },
    continueInvite: {
      label: 'Приглашение продолжить анкету',
      description:
        'Анкета простаивает 3 часа: респонденту отправляется приглашение продолжить заполнение.',
      payload: v.object({
        questionnaireId: F.uuid('анкеты'),
        respondentId: F.uuid('респондента'),
        kind,
        ownerInfo,
      }),
    },
  },
);
