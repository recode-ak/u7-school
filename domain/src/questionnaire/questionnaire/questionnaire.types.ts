import { F } from 'dmg-core';
import * as v from 'valibot';
import type { Question } from './question';
import { QuestionSchema } from './question';

/** Приглашение пройти анкету (статус invited) */
export type InviteResponse = {
  type: 'invited';
  questionnaireId: string;
  inviteText?: string;
  whyText?: string;
  cancelWarning?: string;
};

/** Ожидание выбора (multiple choice, черновики) */
export type WaitNextResponse = {
  type: 'wait_next';
  questionnaireId: string;
  currentQuestion: Question;
  selectedAnswers: string[];
  nextButton?: string;
  cancelWarning?: string;
  questionIndex?: number;
  poolSize?: number;
};

/** Новый вопрос */
export type NewQuestionResponse = {
  type: 'new_question';
  questionnaireId: string;
  question: Question;
  selectedAnswers?: string[];
  previousQuestion?: Question;
  previousSelectedAnswers?: string[];
  cancelWarning?: string;
  questionIndex?: number;
  poolSize?: number;
};

/** Анкета завершена */
export type CompletedResponse = {
  type: 'completed';
  questionnaireId: string;
  selectedAnswers?: string[];
  previousQuestion?: Question;
  previousSelectedAnswers?: string[];
  completionText?: string;
};

/** Причина неактуального ответа */
export type StaleReason = 'stale_button' | 'empty_selection';

/** Неактуальный ответ: состояние не изменилось, UI перерисовывает вопрос. */
export type StaleAnswerResponse = {
  type: 'stale_answer';
  questionnaireId: string;
  question: Question;
  selectedAnswers: string[];
  cancelWarning?: string;
  reason: StaleReason;
  nextButton?: string;
  questionIndex?: number;
  poolSize?: number;
};

export type QuestionnaireActionResponse =
  | InviteResponse
  | WaitNextResponse
  | NewQuestionResponse
  | CompletedResponse
  | StaleAnswerResponse;

// ── Valibot схемы ──

export const InviteResponseSchema = v.object({
  type: v.pipe(v.literal('invited'), v.description('Вид экрана: приглашение')),
  questionnaireId: v.pipe(v.string(), v.description('Идентификатор анкеты')),
  inviteText: v.optional(
    v.pipe(v.string(), v.description('Текст приглашения к анкете')),
  ),
  whyText: v.optional(
    v.pipe(v.string(), v.description('Зачем анкета — пояснение респонденту')),
  ),
  cancelWarning: v.optional(
    v.pipe(v.string(), v.description('Предупреждение при отмене анкеты')),
  ),
});

export const WaitNextResponseSchema = v.object({
  type: v.pipe(
    v.literal('wait_next'),
    v.description('Вид экрана: ожидание кнопки «Далее»'),
  ),
  questionnaireId: v.pipe(v.string(), v.description('Идентификатор анкеты')),
  currentQuestion: v.pipe(QuestionSchema, v.description('Текущий вопрос')),
  selectedAnswers: F.sensitive(
    v.pipe(v.array(v.string()), v.description('Выбранные коды ответов')),
  ),
  nextButton: v.optional(
    v.pipe(v.string(), v.description('Значение кнопки «Далее»')),
  ),
  cancelWarning: v.optional(
    v.pipe(v.string(), v.description('Предупреждение при отмене анкеты')),
  ),
  questionIndex: v.optional(
    v.pipe(v.number(), v.description('Позиция вопроса в пуле (1-based)')),
  ),
  poolSize: v.optional(
    v.pipe(v.number(), v.description('Размер активного маршрута анкеты')),
  ),
});

export const NewQuestionResponseSchema = v.object({
  type: v.pipe(
    v.literal('new_question'),
    v.description('Вид экрана: новый вопрос'),
  ),
  questionnaireId: v.pipe(v.string(), v.description('Идентификатор анкеты')),
  question: v.pipe(QuestionSchema, v.description('Новый вопрос')),
  selectedAnswers: F.sensitive(
    v.optional(
      v.pipe(
        v.array(v.string()),
        v.description('Выбранные коды ответов в черновике'),
      ),
    ),
  ),
  previousQuestion: v.optional(
    v.pipe(QuestionSchema, v.description('Предыдущий вопрос')),
  ),
  previousSelectedAnswers: F.sensitive(
    v.optional(
      v.pipe(v.array(v.string()), v.description('Ответ на предыдущий вопрос')),
    ),
  ),
  cancelWarning: v.optional(
    v.pipe(v.string(), v.description('Предупреждение при отмене анкеты')),
  ),
  questionIndex: v.optional(
    v.pipe(v.number(), v.description('Позиция вопроса в пуле (1-based)')),
  ),
  poolSize: v.optional(
    v.pipe(v.number(), v.description('Размер активного маршрута анкеты')),
  ),
});

export const CompletedResponseSchema = v.object({
  type: v.pipe(
    v.literal('completed'),
    v.description('Вид экрана: анкета завершена'),
  ),
  questionnaireId: v.pipe(v.string(), v.description('Идентификатор анкеты')),
  selectedAnswers: F.sensitive(
    v.optional(
      v.pipe(v.array(v.string()), v.description('Ответ на последний вопрос')),
    ),
  ),
  previousQuestion: v.optional(
    v.pipe(QuestionSchema, v.description('Последний вопрос анкеты')),
  ),
  previousSelectedAnswers: F.sensitive(
    v.optional(
      v.pipe(v.array(v.string()), v.description('Ответ на последний вопрос')),
    ),
  ),
  completionText: v.optional(
    v.pipe(v.string(), v.description('Текст после завершения анкеты')),
  ),
});

export const StaleAnswerResponseSchema = v.object({
  type: v.pipe(
    v.literal('stale_answer'),
    v.description('Вид экрана: неактуальный ответ'),
  ),
  questionnaireId: v.pipe(v.string(), v.description('Идентификатор анкеты')),
  question: v.pipe(QuestionSchema, v.description('Актуальный вопрос')),
  selectedAnswers: F.sensitive(
    v.pipe(
      v.array(v.string()),
      v.description('Выбранные коды ответов в черновике'),
    ),
  ),
  cancelWarning: v.optional(
    v.pipe(v.string(), v.description('Предупреждение при отмене анкеты')),
  ),
  reason: v.pipe(
    v.picklist(['stale_button', 'empty_selection']),
    v.description('Причина неактуального ответа'),
  ),
  nextButton: v.optional(
    v.pipe(v.string(), v.description('Значение кнопки «Далее»')),
  ),
  questionIndex: v.optional(
    v.pipe(v.number(), v.description('Позиция вопроса в пуле (1-based)')),
  ),
  poolSize: v.optional(
    v.pipe(v.number(), v.description('Размер активного маршрута анкеты')),
  ),
});

export const QuestionnaireActionResponseSchema = v.variant('type', [
  InviteResponseSchema,
  WaitNextResponseSchema,
  NewQuestionResponseSchema,
  CompletedResponseSchema,
  StaleAnswerResponseSchema,
]);
