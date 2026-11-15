import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';
import { LikertQuestionPoolSchema } from './likert/likert-question';
import { QuestionnairePoolSchema } from './question';

/** Статус анкеты: приглашение, заполнение, завершение, прерывание. */
export const QuestionnaireStatus = F.picklist(
  ['invited', 'in_progress', 'completed', 'abandoned'],
  'Статус анкеты',
);

/** Причина прерывания анкеты: пользователем или по простою. */
export const AbandonReason = F.picklist(
  ['by_user', 'timeout'],
  'Причина прерывания анкеты',
);

/** Ответ на вопрос анкеты: коды через запятую для multiple-вопроса. */
export const AnswerVo = v.object({
  questionCode: F.string('Код вопроса'),
  answerCode: F.string('Код ответа'),
  answerText: v.optional(F.string('Текст свободного ответа')),
  answeredAt: F.timestamp('ответа'),
});

export type AnswerVo = v.InferOutput<typeof AnswerVo>;

const baseEntries = {
  ...BaseEntityFields,
  respondentId: F.uuid('респондента'),
  status: QuestionnaireStatus,
  currentQuestionCode: v.pipe(
    v.nullable(v.pipe(v.string(), v.nonEmpty())),
    v.description(
      'Код текущего вопроса; null — вопроса нет (приглашение или завершение)',
    ),
  ),
  draftAnswers: F.sensitive(
    v.pipe(
      v.record(v.string(), v.string()),
      v.description(
        'Черновик выбранных кодов по коду вопроса (multiple-выбор)',
      ),
    ),
  ),
  answers: F.sensitive(
    v.pipe(v.array(AnswerVo), v.description('Полученные ответы')),
  ),
  ownerInfo: F.sensitive(
    v.pipe(
      v.record(v.string(), v.unknown()),
      v.description(
        'Данные владельца анкеты; `courseId` — известный ключ, по нему модуль фильтрует, прочее модуль не толкует и передаёт как есть',
      ),
    ),
  ),
  warnedAt: v.optional(
    v.pipe(
      F.timestamp('предупреждения о простое'),
      v.description('Когда отправлено предупреждение о простое'),
    ),
  ),
  continueInvitedAt: v.optional(
    v.pipe(
      F.timestamp('приглашения продолжить'),
      v.description('Когда отправлено приглашение продолжить анкету'),
    ),
  ),
  completedAt: v.pipe(
    v.nullable(F.timestamp('завершения')),
    v.description('Когда анкета завершена; null — не завершена'),
  ),
  abandonReason: v.optional(
    v.pipe(AbandonReason, v.description('Причина прерывания анкеты')),
  ),
};

/** Обычная анкета: пул вопросов с выбором и свободным вводом. */
export const StandardQuestionnaireState = v.object({
  ...baseEntries,
  kind: v.pipe(v.literal('standard'), v.description('Вид анкеты: обычная')),
  questionPool: v.pipe(
    QuestionnairePoolSchema,
    v.description('Пул вопросов обычной анкеты'),
  ),
});

/** Likert-анкета: вопросы со шкалой 1–5 и маппингом на метрики. */
export const LikertQuestionnaireState = v.object({
  ...baseEntries,
  kind: v.pipe(v.literal('likert'), v.description('Вид анкеты: likert')),
  questionPool: v.pipe(
    LikertQuestionPoolSchema,
    v.description('Пул likert-вопросов'),
  ),
});

/**
 * Состояние анкеты: ветка по `kind`. Отсутствующий `updatedAt` подставляется из `createdAt` при разборе
 * `QuestionnaireArDef.state`.
 */
export const QuestionnaireState = v.variant('kind', [
  StandardQuestionnaireState,
  LikertQuestionnaireState,
]);

export type QuestionnaireState = v.InferOutput<typeof QuestionnaireState>;

/** Анкета наружу: копия состояния, даты — числа UTC (DOM-17). */
export const QuestionnaireView = QuestionnaireState;

export type QuestionnaireView = QuestionnaireState;
