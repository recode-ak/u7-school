import type { ReviewState } from '@u7-scl/domain/peer-review';
import { DAY, IDS, T0 } from '../review-campaign/review-campaign.fixture';

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

/** Запись без updatedAt и version (даты числом). */
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
    createdAt: Date.parse('2026-09-20T11:00:00.000Z'),
    ...over,
  };
}

/** Факт отзыва для тестов соседних срезов: только автор и адресат. */
export type ReviewFactStub = { authorId: string; recipientId: string };

/**
 * Записи отзывов из фактов «автор → адресат» для `ReviewRepoFake.seed`;
 * `campaignId` — кампания теста (выборки сверяют её).
 */
export function factReviews(
  facts: readonly ReviewFactStub[],
  campaignId = CAMPAIGN_ID,
): ReviewState[] {
  return facts.map((f) => review({ ...f, campaignId }));
}
