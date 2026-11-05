import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';
import { ReviewRules } from './review.rules';

// Перенос проверок моста `create-review-uc` (окно, адресат) и `ReviewAr.#validateText`.

const CAMPAIGN = '11111111-1111-4111-8111-111111111111';
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const MENTOR = '55555555-5555-4555-8555-555555555555';
const ALICE = '33333333-3333-4333-8333-333333333333';
const STRANGER = '29999999-9999-4999-8999-999999999999';
const T0 = Date.UTC(2026, 8, 20, 10);
const T7 = Date.UTC(2026, 8, 27, 10);

const campaign = ReviewCampaignAr.restore({
  uuid: CAMPAIGN,
  context: 'stream_fate',
  scopeId: '22222222-2222-4222-8222-222222222222',
  subjectId: SUBJECT,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  expiresAt: T7,
  participants: [ALICE],
  payload: { subjectOutcome: 'completed_passed', mentorId: MENTOR },
});

const { windowOpen, recipientAllowed, validText } = ReviewRules.rules;

describe('ReviewRules.windowOpen', () => {
  it('до границы — ok, за 1 мс — ok', () => {
    expectOk(windowOpen.check({ campaign, at: T0 }));
    expectOk(windowOpen.check({ campaign, at: T7 - 1 }));
  });

  it('в момент expiresAt — закрыто (граница включительно), payload с числом', () => {
    const error = expectErr(
      windowOpen.check({ campaign, at: T7 }),
      'REVIEW_WINDOW_CLOSED',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({ campaignId: CAMPAIGN, expiresAt: T7 });

    const later = expectErr(
      windowOpen.check({ campaign, at: T7 + 60_000 }),
      'REVIEW_WINDOW_CLOSED',
    );
    expect(later.payload).toEqual({ campaignId: CAMPAIGN, expiresAt: T7 });
  });
});

describe('ReviewRules.recipientAllowed', () => {
  it.each([
    ['субъект → ментор', SUBJECT, MENTOR],
    ['субъект → соученик', SUBJECT, ALICE],
    ['ментор → субъект', MENTOR, SUBJECT],
  ])('%s — ok', (_l, authorId, recipientId) => {
    expectOk(recipientAllowed.check({ campaign, authorId, recipientId }));
  });

  it.each([
    ['запрет «о себе» (субъект)', SUBJECT, SUBJECT],
    ['адресат не участник кампании', SUBJECT, STRANGER],
    ['ментор → соученик', MENTOR, ALICE],
    ['ментор о себе', MENTOR, MENTOR],
  ])(
    '%s — RECIPIENT_NOT_ALLOWED (conflict) с payload',
    (_l, authorId, recipientId) => {
      const error = expectErr(
        recipientAllowed.check({ campaign, authorId, recipientId }),
        'REVIEW_RECIPIENT_NOT_ALLOWED',
      );
      expect(error.kind).toBe('conflict');
      expect(error.payload).toEqual({
        campaignId: CAMPAIGN,
        authorId,
        recipientId,
      });
    },
  );

  it('автор не автор окна — адресатов нет, любой отказ', () => {
    expectErr(
      recipientAllowed.check({
        campaign,
        authorId: ALICE,
        recipientId: MENTOR,
      }),
      'REVIEW_RECIPIENT_NOT_ALLOWED',
    );
  });
});

describe('ReviewRules.validText', () => {
  it('границы 10 и 3500 — ok', () => {
    expectOk(validText.check({ text: 'а'.repeat(10) }));
    expectOk(validText.check({ text: 'а'.repeat(3500) }));
  });

  it.each([
    ['пустой', ''],
    ['короче минимума (9)', 'а'.repeat(9)],
    ['длиннее максимума (3501)', 'а'.repeat(3501)],
  ])(
    '%s — TEXT_INVALID (validation), payload { min, max, length }',
    (_l, text) => {
      const error = expectErr(validText.check({ text }), 'REVIEW_TEXT_INVALID');
      expect(error.kind).toBe('validation');
      expect(error.payload).toEqual({
        min: 10,
        max: 3500,
        length: text.length,
      });
    },
  );
});
