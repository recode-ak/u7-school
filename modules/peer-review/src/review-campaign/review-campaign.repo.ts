import type { ReviewCampaignAr } from '@u7-scl/domain/peer-review';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория кампаний отзывов: принимает и возвращает Ar (API-03). */
export type ReviewCampaignRepo = Repository<ReviewCampaignAr> & {
  /** Кампания по UUID. */
  findById(uuid: string): Promise<ReviewCampaignAr | undefined>;

  /** Кампания окна по ключу (скоуп, субъект) — основа правила `unique`. */
  findBySubject(
    scopeId: string,
    subjectId: string,
  ): Promise<ReviewCampaignAr | undefined>;

  /** Кампании, где пользователь — субъект окна и окно открыто на момент `at`. */
  findActiveBySubject(userId: string, at: number): Promise<ReviewCampaignAr[]>;

  /** Кампании, где пользователь — ментор и окно открыто на момент `at`. */
  findActiveByMentor(userId: string, at: number): Promise<ReviewCampaignAr[]>;
};
