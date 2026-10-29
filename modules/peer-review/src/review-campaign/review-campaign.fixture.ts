import type { ReviewCampaignState } from '@u7-scl/domain/peer-review';

/** Общие идентификаторы и сборка записей кампаний для тестов среза review-campaign. */
export const IDS = {
  scope: '11111111-1111-4111-8111-111111111111',
  scope2: '11111111-1111-4111-8111-111111111112',
  alice: '22222222-2222-4222-8222-222222222222',
  bob: '24444444-4444-4444-8444-444444444444',
  carol: '25555555-5555-4555-8555-555555555555',
  mentor: '33333333-3333-4333-8333-333333333333',
  stranger: '29999999-9999-4999-8999-999999999999',
};

export const DAY = 24 * 60 * 60 * 1000;
export const T0 = Date.UTC(2026, 8, 20, 10);

/** Запись нового формата (числа) с окном в 7 суток от `createdAt`. */
export function campaign(
  over: Partial<ReviewCampaignState> = {},
): ReviewCampaignState {
  const createdAt = over.createdAt ?? T0;
  return {
    uuid: crypto.randomUUID(),
    context: 'stream_fate',
    scopeId: IDS.scope,
    subjectId: IDS.alice,
    createdAt,
    updatedAt: createdAt,
    version: 0,
    expiresAt: createdAt + 7 * DAY,
    participants: [IDS.bob],
    payload: { subjectOutcome: 'completed_passed', mentorId: IDS.mentor },
    ...over,
  };
}
