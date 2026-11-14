import type { ReadonlyAr } from 'dmg-core';
import type { CampaignAuthorRole } from '../shared/campaign-fields';
import type { ReviewCampaignAr } from './review-campaign.ar';

/**
 * Рецензия в узком виде для вычислений: автор и адресат. Сущность Review
 * сюда не попадает — DQS не зависит от её формы.
 */
export type ReviewFact = {
  readonly authorId: string;
  readonly recipientId: string;
};

/** Прогресс M/K: мои отзывы против адресатов политики. */
export type CampaignProgress = {
  /** M — мои отзывы в кампании. */
  readonly done: number;
  /** K — доступные адресаты по политике. */
  readonly total: number;
};

/** Факты «моей кампании» — общие для списка и деталки. */
export type MyCampaignFacts = {
  readonly myRole: CampaignAuthorRole;
  readonly daysLeft: number;
  readonly progress: CampaignProgress;
};

/** Адресат с признаком «мой отзыв уже есть». */
export type RecipientWithMyReview = {
  readonly userId: string;
  readonly hasMyReview: boolean;
};

/**
 * DQS: факты кампании отзывов поверх кампании и рецензий (узкие факты).
 * Только читает; роль и адресатов спрашивает у `ReviewCampaignAr`.
 */
export class CampaignFactsDqs {
  constructor(
    private readonly campaign: ReadonlyAr<ReviewCampaignAr>,
    private readonly reviews: readonly ReviewFact[],
  ) {}

  /**
   * Факты «моей кампании» на момент `at`: роль автора, остаток дней, прогресс
   * M/K. Не автор окна (соученик, посторонний) — `undefined`.
   */
  myFacts(userId: string, at: number): MyCampaignFacts | undefined {
    const myRole = this.campaign.authorRoleOf(userId);
    if (myRole === undefined) return undefined;
    return {
      myRole,
      daysLeft: this.campaign.daysLeft(at),
      progress: {
        done: this.reviews.filter((r) => r.authorId === userId).length,
        total: this.campaign.targetIdsFor(userId).length,
      },
    };
  }

  /** Адресаты автора с признаком «уже писал»; порядок — как у адресатов Ar. */
  recipientsWithMyReview(userId: string): RecipientWithMyReview[] {
    const written = new Set(
      this.reviews
        .filter((r) => r.authorId === userId)
        .map((r) => r.recipientId),
    );
    return this.campaign.targetIdsFor(userId).map((targetId) => ({
      userId: targetId,
      hasMyReview: written.has(targetId),
    }));
  }
}
