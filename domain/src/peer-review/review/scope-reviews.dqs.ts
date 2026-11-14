import type { ReadonlyAr } from 'dmg-core';
import type { ReviewAr } from './review.ar';
import type { RecipientReviewsGroup } from './review.types';

/**
 * DQS: проекция отзывов скоупа (много агрегатов Review) для рендера.
 */
export class ScopeReviewsDqs {
  constructor(private readonly reviews: readonly ReadonlyAr<ReviewAr>[]) {}

  /**
   * Группировка отзывов по адресатам: группы в порядке первого появления
   * (после сортировки), внутри — по времени создания, затем по uuid.
   */
  groupByRecipient(): RecipientReviewsGroup[] {
    const ordered = this.reviews
      .map((r) => r.view())
      .sort(
        (a, b) => a.createdAt - b.createdAt || a.uuid.localeCompare(b.uuid),
      );

    const groups = new Map<string, RecipientReviewsGroup>();
    for (const r of ordered) {
      let group = groups.get(r.recipientId);
      if (!group) {
        group = { recipientId: r.recipientId, reviews: [] };
        groups.set(r.recipientId, group);
      }
      group.reviews.push({
        reviewId: r.uuid,
        scopeId: r.scopeId,
        authorId: r.authorId,
        direction: r.direction,
        ...(r.authorOutcome ? { authorOutcome: r.authorOutcome } : {}),
        text: r.text,
        createdAt: r.createdAt,
      });
    }
    return [...groups.values()];
  }
}
