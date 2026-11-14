import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireArDef } from '../questionnaire.ar';
import { QuestionnairePolicy } from '../questionnaire.policy';
import {
  LikertQuestionnaireState,
  QuestionnaireView,
  StandardQuestionnaireState,
} from '../questionnaire.state';

/** Список анкет пользователя. */
export const GetQuestionnairesByUserUcDef = UseCaseDef.define({
  name: 'getQuestionnairesByUser',
  label: 'Получить анкеты пользователя',
  description:
    'Возвращает анкеты респондента. Свой список читает сам пользователь, чужой — администратор. Необязательные фильтры: статус, вид, курс.',
  type: 'query',
  aggregate: QuestionnaireArDef,
  callers: ['user'],
  policy: QuestionnairePolicy.rules.canListFor,
  input: v.object({
    userId: v.pipe(F.uuid('пользователя'), v.description('Респондент')),
    status: v.pipe(
      v.optional(StandardQuestionnaireState.entries.status),
      v.description('Только анкеты в этом статусе'),
    ),
    kind: v.pipe(
      v.optional(
        v.union([
          StandardQuestionnaireState.entries.kind,
          LikertQuestionnaireState.entries.kind,
        ]),
      ),
      v.description('Только анкеты этого вида'),
    ),
    courseId: v.pipe(
      v.optional(F.uuid('курса')),
      v.description('Только анкеты этого курса (`ownerInfo.courseId`)'),
    ),
  }),
  output: v.pipe(
    v.array(QuestionnaireView),
    v.description('Анкеты пользователя'),
  ),
  errors: [],
});
