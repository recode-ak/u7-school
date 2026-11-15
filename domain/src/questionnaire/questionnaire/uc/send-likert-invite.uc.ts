import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { LikertQuestionPoolSchema } from '../likert/likert-question';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';
import { QuestionnairePolicy } from '../questionnaire.policy';

/** Приглашение на likert-анкету: создаёт анкету в статусе invited. */
export const SendLikertInviteUcDef = UseCaseDef.define({
  name: 'sendLikertInvite',
  label: 'Пригласить на likert-анкету',
  description:
    'Создаёт likert-анкету в статусе invited и публикует invited. Респондент принимает приглашение или отказывается.',
  type: 'command',
  aggregate: QuestionnaireArDef,
  callers: ['system'],
  policy: QuestionnairePolicy.rules.hasRespondent,
  input: v.object({
    pool: v.pipe(
      LikertQuestionPoolSchema,
      v.description('Пул likert-вопросов анкеты'),
    ),
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
  emits: [QuestionnaireEvents.invited],
});
