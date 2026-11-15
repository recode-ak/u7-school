import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';
import { StudentOutcomeSchema } from '../shared/campaign-fields';
import {
  REVIEW_TEXT_MAX_LENGTH,
  REVIEW_TEXT_MIN_LENGTH,
} from './review.constants';

export { REVIEW_TEXT_MAX_LENGTH, REVIEW_TEXT_MIN_LENGTH };

/** Схема текста отзыва (10–3500 символов). */
export const ReviewTextSchema = v.pipe(
  v.string(),
  v.minLength(REVIEW_TEXT_MIN_LENGTH, 'Отзыв слишком короткий'),
  v.maxLength(REVIEW_TEXT_MAX_LENGTH, 'Отзыв слишком длинный'),
);

/**
 * Направление отзыва «кто о ком» (ФР-4): студент о студенте, студент о
 * менторе, ментор о студенте. Пара «ментор о менторе» исключена типом.
 */
export const ReviewDirectionSchema = F.picklist(
  ['student_student', 'student_mentor', 'mentor_student'],
  'направления отзыва: кто о ком',
);

export type ReviewDirection = v.InferOutput<typeof ReviewDirectionSchema>;

/**
 * Entity отзыва — единственное место структуры состояния. Пара (кампания,
 * автор, адресат) уникальна: повтор перезаписывает `text`. Legacy-записи
 * читаются: ISO-даты → число, нет `updatedAt` → `createdAt` (D-36).
 */
export const ReviewState = v.object({
  ...BaseEntityFields,
  scopeId: F.uuid('скоупа кампании — денормализация для выборок по скоупу'),
  campaignId: F.uuid('кампании отзывов'),
  authorId: F.uuid('автора отзыва'),
  direction: ReviewDirectionSchema,
  authorOutcome: v.pipe(
    v.optional(StudentOutcomeSchema),
    v.description('Снимок исхода автора-студента; у ментора его нет'),
  ),
  recipientId: F.uuid('адресата отзыва'),
  text: F.sensitive(
    v.pipe(ReviewTextSchema, v.description('Текст отзыва (10–3500 символов)')),
  ),
});

export type ReviewState = v.InferOutput<typeof ReviewState>;
