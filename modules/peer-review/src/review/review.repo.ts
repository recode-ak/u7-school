import type { ReviewAr, ReviewFilter } from '@u7-scl/domain/peer-review';
import type { Repository } from 'dmg-core/app';

/**
 * Порт репозитория отзывов: принимает и возвращает Ar (API-03). Фильтр
 * (`ReviewFilter`, поля по И) применяет репозиторий. Уникальность пары
 * (кампания, автор, адресат) — инвариант записи.
 */
export type ReviewRepo = Repository<ReviewAr> & {
  /** Отзыв по UUID. */
  findById(uuid: string): Promise<ReviewAr | undefined>;

  /** Отзыв парой (кампания, автор, адресат) — перезапись и признак «написан». */
  findByPair(
    campaignId: string,
    authorId: string,
    recipientId: string,
  ): Promise<ReviewAr | undefined>;

  /** Отзывы автора в кампании — прогресс и признаки «мой отзыв есть». */
  findByCampaignAndAuthor(
    campaignId: string,
    authorId: string,
  ): Promise<ReviewAr[]>;

  /** Все отзывы скоупа. */
  findByScope(scopeId: string): Promise<ReviewAr[]>;

  /** Все отзывы списка скоупов, с фильтром. */
  findByScopes(
    scopeIds: readonly string[],
    filter?: ReviewFilter,
  ): Promise<ReviewAr[]>;

  /** Все отзывы, адресованные пользователю, с фильтром. */
  findByRecipient(
    recipientId: string,
    filter?: ReviewFilter,
  ): Promise<ReviewAr[]>;
};
