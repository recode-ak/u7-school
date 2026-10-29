import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ReviewCampaignEvents } from './review-campaign.events';

const id = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const payload = {
  campaignId: id(1),
  context: 'stream_fate' as const,
  scopeId: id(2),
  subjectId: id(3),
  mentorId: id(4),
  subjectOutcome: 'completed_passed' as const,
};

describe('ReviewCampaignEvents.created (MAN-08)', () => {
  it('FQN peer-review.review-campaign.created (было student-campaign.created)', () => {
    expect(ReviewCampaignEvents.created.name).toBe(
      'peer-review.review-campaign.created',
    );
  });

  it('payload: campaignId, context, scopeId, subjectId, mentorId, subjectOutcome', () => {
    const { payload: schema } = ReviewCampaignEvents.created;
    expect(v.parse(schema, payload)).toEqual(payload);
    for (const key of Object.keys(payload)) {
      const { [key as keyof typeof payload]: _, ...rest } = payload;
      expect(v.safeParse(schema, rest).success).toBe(false);
    }
    expect(
      v.safeParse(schema, { ...payload, subjectOutcome: 'in_progress' })
        .success,
    ).toBe(false);
    expect(v.safeParse(schema, { ...payload, mentorId: 'x' }).success).toBe(
      false,
    );
  });

  it('make собирает событие с этим payload', () => {
    expect(ReviewCampaignEvents.created.make(payload).payload).toEqual(payload);
  });
});
