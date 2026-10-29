import type { ReviewFact } from '@u7-scl/domain/peer-review';

/**
 * Рецензии автора в кампании — узкий порт чтения для прогресса и отметок
 * «мой отзыв есть». TR: до среза `review` (Ф2) его реализует legacy
 * `ReviewJsonRepo`; DQS на входе не меняется.
 */
export type ReviewFactsReader = {
  findByCampaignAndAuthor(
    campaignId: string,
    authorId: string,
  ): Promise<readonly ReviewFact[]>;
};
