import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { ReviewCampaignArDef } from './review-campaign.ar';

const UUIDS = {
  campaign: '11111111-1111-4111-8111-111111111111',
  scope: '22222222-2222-4222-8222-222222222222',
  subject: '77777777-7777-4777-8777-777777777777',
  mentor: '55555555-5555-4555-8555-555555555555',
  user1: '33333333-3333-4333-8333-333333333333',
  user2: '44444444-4444-4444-8444-444444444444',
};

/** Legacy-запись как в `campaigns.json` релиза: ISO без зоны, без `updatedAt` и `version`. */
function legacy(overrides: Record<string, unknown> = {}) {
  return {
    uuid: UUIDS.campaign,
    context: 'stream_fate',
    scopeId: UUIDS.scope,
    subjectId: UUIDS.subject,
    createdAt: '2026-09-20T10:00',
    expiresAt: '2026-09-27T10:00',
    participants: [UUIDS.user1, UUIDS.user2],
    payload: { subjectOutcome: 'completed_passed', mentorId: UUIDS.mentor },
    ...overrides,
  };
}

const parse = (input: unknown) => v.safeParse(ReviewCampaignArDef.state, input);

describe('ReviewCampaignState — форма (ФР-1, ФР-3)', () => {
  test('схема state: валидно/невалидно', () => {
    const cases: [string, unknown, boolean][] = [
      ['контекст stream_fate', legacy(), true],
      [
        'пустой participants (адресат только ментор)',
        legacy({ participants: [] }),
        true,
      ],
      [
        'старый контекст stream_ended',
        legacy({ context: 'stream_ended' }),
        false,
      ],
      ['прочий контекст exit', legacy({ context: 'exit' }), false],
      ['не uuid в participants', legacy({ participants: ['x'] }), false],
      [
        'списочная форма participants со статусами',
        legacy({ participants: [{ userId: UUIDS.user1, role: 'student' }] }),
        false,
      ],
    ];
    for (const [name, record, ok] of cases) {
      expect({ name, ok: parse(record).success }).toEqual({ name, ok });
    }
  });
});
