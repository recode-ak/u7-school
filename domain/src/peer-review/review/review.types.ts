import { F } from 'dmg-core';
import * as v from 'valibot';
import { epochMsField, StudentOutcomeSchema } from '../shared/campaign-fields';
import { ReviewDirectionSchema } from './review.state';

/**
 * Фильтр списков отзывов: поля сочетаются по И, все необязательные. Фильтрует
 * репозиторий (не UC и не story).
 */
export const ReviewFilterSchema = v.pipe(
  v.object({
    direction: v.optional(ReviewDirectionSchema),
    recipientId: v.optional(F.uuid('адресата отзыва')),
    campaignId: v.optional(F.uuid('кампании отзывов')),
  }),
  v.description('Сужение списка отзывов по направлению, адресату, кампании'),
);

export type ReviewFilter = v.InferOutput<typeof ReviewFilterSchema>;

/** Снимок отзыва для рендера: направление и снимок исхода автора. */
export const ReviewSnapshotSchema = v.object({
  reviewId: F.uuid('отзыва'),
  scopeId: F.uuid('скоупа'),
  authorId: F.uuid('автора'),
  direction: ReviewDirectionSchema,
  authorOutcome: v.optional(StudentOutcomeSchema),
  text: F.sensitive(v.pipe(v.string(), v.description('Текст отзыва'))),
  createdAt: epochMsField('создания отзыва'),
});

export type ReviewSnapshot = v.InferOutput<typeof ReviewSnapshotSchema>;

/** Группа отзывов об одном адресате. */
export const RecipientReviewsGroupSchema = v.object({
  recipientId: F.uuid('адресата'),
  reviews: v.pipe(
    v.array(ReviewSnapshotSchema),
    v.description('Отзывы об адресате по времени создания'),
  ),
});

export type RecipientReviewsGroup = v.InferOutput<
  typeof RecipientReviewsGroupSchema
>;
