import { describe, expect, it } from 'bun:test';
import { CampaignFactsDqs } from './campaign-facts.dqs';
import { ReviewCampaignAr } from './review-campaign.ar';

// Перенос campaign-facts-ds.test.ts: DQS на готовых Ar + узких фактах рецензий
// ({ authorId, recipientId }), без сущности Review.
const T0 = Date.UTC(2026, 8, 20, 10);
const SCOPE = '22222222-2222-4222-8222-222222222222';
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const BOB = '44444444-4444-4444-8444-444444444444';
const MENTOR = '55555555-5555-4555-8555-555555555555';

const campaign = () =>
  ReviewCampaignAr.restore({
    uuid: '11111111-1111-4111-8111-111111111111',
    context: 'stream_fate',
    scopeId: SCOPE,
    subjectId: SUBJECT,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
    expiresAt: T0 + 7 * 24 * 3600 * 1000,
    participants: [BOB],
    payload: { subjectOutcome: 'completed_passed', mentorId: MENTOR },
  });

describe('CampaignFactsDqs.myFacts', () => {
  it('роль из Ar, M — только мои рецензии, K — адресаты политики, daysLeft от at', () => {
    const reviews = [
      { authorId: SUBJECT, recipientId: MENTOR },
      { authorId: BOB, recipientId: SUBJECT }, // чужая — в M не считается
      { authorId: BOB, recipientId: MENTOR },
    ];
    expect(
      new CampaignFactsDqs(campaign(), reviews).myFacts(SUBJECT, T0),
    ).toEqual({
      myRole: 'subject',
      daysLeft: 7,
      progress: { done: 1, total: 2 },
    });
  });

  it('ментор: K = 1 (субъект), daysLeft истёкшей = 0', () => {
    const at = T0 + 8 * 24 * 3600 * 1000;
    expect(
      new CampaignFactsDqs(campaign(), [
        { authorId: MENTOR, recipientId: SUBJECT },
      ]).myFacts(MENTOR, at),
    ).toEqual({
      myRole: 'mentor',
      daysLeft: 0,
      progress: { done: 1, total: 1 },
    });
  });
});

describe('CampaignFactsDqs.recipientsWithMyReview', () => {
  it('признак «мой отзыв есть» только там, где он есть; порядок — как у адресатов', () => {
    expect(
      new CampaignFactsDqs(campaign(), [
        { authorId: SUBJECT, recipientId: MENTOR },
      ]).recipientsWithMyReview(SUBJECT),
    ).toEqual([
      { userId: BOB, hasMyReview: false },
      { userId: MENTOR, hasMyReview: true },
    ]);
  });

  it('чужой отзыв тому же адресату не даёт признак «мой отзыв есть»', () => {
    expect(
      new CampaignFactsDqs(campaign(), [
        { authorId: BOB, recipientId: MENTOR },
      ]).recipientsWithMyReview(SUBJECT),
    ).toEqual([
      { userId: BOB, hasMyReview: false },
      { userId: MENTOR, hasMyReview: false },
    ]);
  });

  it('ментор: единственный адресат — субъект', () => {
    expect(
      new CampaignFactsDqs(campaign(), []).recipientsWithMyReview(MENTOR),
    ).toEqual([{ userId: SUBJECT, hasMyReview: false }]);
  });
});
