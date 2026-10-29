import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetMyCampaignsUcDef } from './get-my-campaigns.uc';

const ID = '11111111-1111-4111-8111-111111111111';
const card = {
  campaignId: ID,
  context: 'stream_fate',
  scopeId: ID,
  subjectId: ID,
  myRole: 'subject',
  expiresAt: Date.UTC(2026, 8, 27, 10),
  subjectOutcome: 'completed_passed',
  daysLeft: 7,
  progress: { done: 0, total: 2 },
};

describe('GetMyCampaignsUcDef', () => {
  it('query пользователя над кампанией, allowAll, без ошибок и событий', () => {
    expect(normalize(GetMyCampaignsUcDef)).toMatchObject({
      name: 'getMyCampaigns',
      type: 'query',
      aggregate: 'review-campaign',
      callers: ['user'],
      errors: [],
      emits: [],
    });
    expect(GetMyCampaignsUcDef.policy.op).toBe('allowAll');
  });

  it('вход без userId: onlyLives?, filter? { context?, scopeId? }', () => {
    const { input } = GetMyCampaignsUcDef;
    expect(v.safeParse(input, {}).success).toBe(true);
    expect(v.safeParse(input, { onlyLives: true }).success).toBe(true);
    expect(
      v.safeParse(input, {
        filter: { context: 'stream_fate', scopeId: ID },
      }).success,
    ).toBe(true);
    expect(v.safeParse(input, { filter: { context: 'exit' } }).success).toBe(
      false,
    );
    expect(v.safeParse(input, { filter: { scopeId: 'x' } }).success).toBe(
      false,
    );
    expect(Object.keys((input as { entries: object }).entries)).not.toContain(
      'userId',
    );
  });

  it('выход — список карточек; expiresAt — число (F.timestamp)', () => {
    const { output } = GetMyCampaignsUcDef;
    expect(v.parse(output, [card])).toEqual([card as never]);
    expect(v.parse(output, [])).toEqual([]);
    expect(
      v.safeParse(output, [{ ...card, expiresAt: '2026-09-27T10:00' }]).success,
    ).toBe(false);
    expect(v.safeParse(output, [{ ...card, myRole: 'peer' }]).success).toBe(
      false,
    );
    expect(v.safeParse(output, [{ ...card, daysLeft: -1 }]).success).toBe(
      false,
    );
    expect(
      v.safeParse(output, [{ ...card, progress: { done: 0 } }]).success,
    ).toBe(false);
  });
});
