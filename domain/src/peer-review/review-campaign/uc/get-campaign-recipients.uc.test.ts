import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ReviewCampaignPolicy } from '../review-campaign.policy';
import { GetCampaignRecipientsUcDef } from './get-campaign-recipients.uc';

const ID = '11111111-1111-4111-8111-111111111111';
const view = {
  campaignId: ID,
  context: 'stream_fate',
  myRole: 'mentor',
  mentorId: ID,
  subjectOutcome: 'dropped',
  daysLeft: 3,
  recipients: [{ userId: ID, hasMyReview: false }],
};

describe('GetCampaignRecipientsUcDef', () => {
  it('query пользователя; Policy isWindowAuthor; ошибка CAMPAIGN_NOT_FOUND', () => {
    expect(normalize(GetCampaignRecipientsUcDef)).toMatchObject({
      name: 'getCampaignRecipients',
      type: 'query',
      aggregate: 'review-campaign',
      callers: ['user'],
      errors: ['REVIEW_CAMPAIGN_NOT_FOUND'],
    });
    expect(GetCampaignRecipientsUcDef.policy).toBe(
      ReviewCampaignPolicy.rules.isWindowAuthor,
    );
  });

  it('вход — { campaignId } uuid, без authorId', () => {
    const { input } = GetCampaignRecipientsUcDef;
    expect(v.safeParse(input, { campaignId: ID }).success).toBe(true);
    expect(v.safeParse(input, { campaignId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
    expect(Object.keys((input as { entries: object }).entries)).toEqual([
      'campaignId',
    ]);
  });

  it('выход: роль, ментор, исход, daysLeft, адресаты с hasMyReview', () => {
    const { output } = GetCampaignRecipientsUcDef;
    expect(v.parse(output, view)).toEqual(view as never);
    expect(v.safeParse(output, { ...view, daysLeft: 0.5 }).success).toBe(false);
    expect(v.safeParse(output, { ...view, myRole: 'x' }).success).toBe(false);
    expect(
      v.safeParse(output, { ...view, recipients: [{ userId: ID }] }).success,
    ).toBe(false);
  });
});
