import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ReviewCampaignErrors } from '../review-campaign/review-campaign.errors';
import { ReviewErrors } from './review.errors';

const byCode = (code: string) =>
  Object.values(ReviewErrors).find((e) => e.code === code);
const ID = '11111111-1111-4111-8111-111111111111';

describe('ReviewErrors — группа REVIEW (ERR-04)', () => {
  it('ровно три ошибки: коды и kind', () => {
    expect(Object.values(ReviewErrors).map((e) => [e.code, e.kind])).toEqual([
      ['REVIEW_WINDOW_CLOSED', 'conflict'],
      ['REVIEW_RECIPIENT_NOT_ALLOWED', 'conflict'],
      ['REVIEW_TEXT_INVALID', 'validation'],
    ]);
  });

  it('NOT_PARTICIPANT (вместо него ACCESS_DENIED), DUPLICATE и CAMPAIGN_NOT_FOUND не объявлены', () => {
    const keys = Object.keys(ReviewErrors);
    for (const gone of ['NOT_PARTICIPANT', 'DUPLICATE', 'CAMPAIGN_NOT_FOUND']) {
      expect(keys).not.toContain(gone);
    }
  });

  it('REVIEW_CAMPAIGN_NOT_FOUND — ссылкой из ошибок кампании (ERR-03)', () => {
    expect(ReviewCampaignErrors.NOT_FOUND.code).toBe(
      'REVIEW_CAMPAIGN_NOT_FOUND',
    );
  });

  it('тексты legacy сохранены', () => {
    expect(byCode('REVIEW_WINDOW_CLOSED')?.label).toBe(
      'Возможность оставлять отзывы закрыта: срок кампании истёк',
    );
    expect(byCode('REVIEW_RECIPIENT_NOT_ALLOWED')?.label).toBe(
      'Адресат недоступен по политике для роли автора',
    );
    expect(byCode('REVIEW_TEXT_INVALID')?.label).toBe(
      'Текст отзыва должен быть от 10 до 3500 символов',
    );
  });

  it('WINDOW_CLOSED: payload { campaignId, expiresAt } — число, не ISO-строка', () => {
    const { payload } = ReviewErrors.WINDOW_CLOSED;
    expect(
      v.safeParse(payload, { campaignId: ID, expiresAt: Date.UTC(2026, 8, 27) })
        .success,
    ).toBe(true);
    expect(
      v.safeParse(payload, { campaignId: ID, expiresAt: '2026-09-27T10:00' })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(payload, { campaignId: 'x', expiresAt: 1 }).success,
    ).toBe(false);
  });

  it('RECIPIENT_NOT_ALLOWED: payload { campaignId, authorId, recipientId }', () => {
    const { payload } = ReviewErrors.RECIPIENT_NOT_ALLOWED;
    const full = { campaignId: ID, authorId: ID, recipientId: ID };
    expect(v.safeParse(payload, full).success).toBe(true);
    expect(v.safeParse(payload, { campaignId: ID, authorId: ID }).success).toBe(
      false,
    );
  });

  it('TEXT_INVALID: payload { min, max, length }', () => {
    const { payload } = ReviewErrors.TEXT_INVALID;
    expect(
      v.safeParse(payload, { min: 10, max: 3500, length: 3 }).success,
    ).toBe(true);
    expect(v.safeParse(payload, { min: 10, max: 3500 }).success).toBe(false);
  });
});
