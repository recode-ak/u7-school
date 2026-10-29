import {
  ReviewAr,
  ReviewArDef,
  type ReviewFilter,
  type ReviewState,
} from '@u7-scl/domain/peer-review';
import { DAY, IDS, T0 } from '../review-campaign/review-campaign.fixture';
import type { ReviewRepo } from './review.repo';

export { DAY, IDS, T0 };

/** Кампания, к которой относятся записи рецензий в тестах среза review. */
export const CAMPAIGN_ID = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const HOUR = 60 * 60 * 1000;
export const TEXT = 'Крепкий напарник по паре, всё получалось.';

/** Запись нового формата (числа): субъект alice → ментору. */
export function review(over: Partial<ReviewState> = {}): ReviewState {
  const createdAt = over.createdAt ?? T0 + HOUR;
  return {
    uuid: crypto.randomUUID(),
    scopeId: IDS.scope,
    campaignId: CAMPAIGN_ID,
    authorId: IDS.alice,
    direction: 'student_mentor',
    authorOutcome: 'completed_passed',
    recipientId: IDS.mentor,
    text: 'Текст отзыва достаточной длины.',
    createdAt,
    updatedAt: createdAt,
    version: 0,
    ...over,
  };
}

/** Legacy-запись релиза: ISO без зоны, без updatedAt и version. */
export function legacyReview(over: Record<string, unknown> = {}) {
  return {
    uuid: crypto.randomUUID(),
    scopeId: IDS.scope,
    campaignId: CAMPAIGN_ID,
    authorId: IDS.alice,
    direction: 'student_mentor',
    authorOutcome: 'completed_passed',
    recipientId: IDS.mentor,
    text: 'Текст отзыва достаточной длины.',
    createdAt: '2026-09-20T11:00',
    ...over,
  };
}

/** Факт отзыва для тестов соседних срезов: только автор и адресат. */
export type ReviewFactStub = { authorId: string; recipientId: string };

/**
 * Репозиторий отзывов в памяти для тестов кампаний: отзывы собраны из фактов
 * «автор → адресат». Факты не привязаны к кампании, поэтому
 * `findByCampaignAndAuthor` не сверяет `campaignId`; остальные запросы
 * честные. Запись не нужна — `save` кладёт агрегат в список.
 */
export class FactsReviewRepo implements ReviewRepo {
  readonly aggregate = ReviewArDef;
  private readonly all: ReviewAr[];

  constructor(facts: readonly ReviewFactStub[] = []) {
    this.all = facts.map((f) => ReviewAr.restore(review({ ...f })));
  }

  async save(ar: ReviewAr): Promise<void> {
    this.all.push(ar);
  }

  async findById(uuid: string) {
    return this.all.find((r) => r.uuid === uuid);
  }

  async findByPair(campaignId: string, authorId: string, recipientId: string) {
    return this.all.find(
      (r) =>
        r.campaignId === campaignId &&
        r.authorId === authorId &&
        r.recipientId === recipientId,
    );
  }

  async findByCampaignAndAuthor(_campaignId: string, authorId: string) {
    return this.all.filter((r) => r.authorId === authorId);
  }

  async findByScope(scopeId: string) {
    return this.all.filter((r) => r.scopeId === scopeId);
  }

  async findByScopes(scopeIds: readonly string[], filter?: ReviewFilter) {
    return this.all.filter(
      (r) => scopeIds.includes(r.scopeId) && matchesFilter(r, filter),
    );
  }

  async findByRecipient(recipientId: string, filter?: ReviewFilter) {
    return this.all.filter(
      (r) => r.recipientId === recipientId && matchesFilter(r, filter),
    );
  }
}

function matchesFilter(r: ReviewAr, f?: ReviewFilter): boolean {
  return (
    (f?.direction === undefined || r.direction === f.direction) &&
    (f?.recipientId === undefined || r.recipientId === f.recipientId) &&
    (f?.campaignId === undefined || r.campaignId === f.campaignId)
  );
}
