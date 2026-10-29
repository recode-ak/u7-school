import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ReviewCampaignErrors } from './review-campaign.errors';

const byCode = (code: string) =>
  Object.values(ReviewCampaignErrors).find((e) => e.code === code);
const CAMPAIGN = '11111111-1111-4111-8111-111111111111';

describe('ReviewCampaignErrors — группа REVIEW_CAMPAIGN (ERR-04)', () => {
  it('ровно три ошибки: коды и kind', () => {
    expect(
      Object.values(ReviewCampaignErrors).map((e) => [e.code, e.kind]),
    ).toEqual([
      ['REVIEW_CAMPAIGN_NOT_FOUND', 'not_found'],
      ['REVIEW_CAMPAIGN_ALREADY_EXISTS', 'conflict'],
      ['REVIEW_CAMPAIGN_INVALID_PARTICIPANTS', 'validation'],
    ]);
  });

  it('WINDOW_CLOSED, NOT_PARTICIPANT, RECIPIENT_NOT_ALLOWED переехали в Review (Ф2)', () => {
    const keys = Object.keys(ReviewCampaignErrors);
    for (const gone of [
      'WINDOW_CLOSED',
      'NOT_PARTICIPANT',
      'RECIPIENT_NOT_ALLOWED',
    ]) {
      expect(keys).not.toContain(gone);
    }
  });

  it('NOT_FOUND: текст legacy и payload { campaignId }', () => {
    const e = byCode(
      'REVIEW_CAMPAIGN_NOT_FOUND',
    ) as never as (typeof ReviewCampaignErrors)[keyof typeof ReviewCampaignErrors] & {
      make: (p: object) => { payload: unknown };
    };
    expect(e.label).toBe('Кампания отзывов не найдена');
    expect(e.make({ campaignId: CAMPAIGN }).payload).toEqual({
      campaignId: CAMPAIGN,
    });
    expect(v.safeParse(e.payload as never, { campaignId: 'x' }).success).toBe(
      false,
    );
  });

  it('ALREADY_EXISTS: payload { scopeId, subjectId }', () => {
    const e = byCode('REVIEW_CAMPAIGN_ALREADY_EXISTS') as never as {
      payload: never;
    };
    expect(
      v.safeParse(e.payload as never, {
        scopeId: CAMPAIGN,
        subjectId: CAMPAIGN,
      }).success,
    ).toBe(true);
    expect(v.safeParse(e.payload as never, { scopeId: CAMPAIGN }).success).toBe(
      false,
    );
  });
});
