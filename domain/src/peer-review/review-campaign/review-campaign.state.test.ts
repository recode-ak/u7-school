import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { ReviewCampaignArDef } from './review-campaign.ar';
import { ReviewCampaignState } from './review-campaign.state';

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

describe('ReviewCampaignArDef.state — legacy-запись (D-36)', () => {
  test('ISO без зоны читается как UTC-число; updatedAt = createdAt; version = 0', () => {
    const res = parse(legacy());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.output.createdAt).toBe(Date.UTC(2026, 8, 20, 10));
    expect(res.output.expiresAt).toBe(Date.UTC(2026, 8, 27, 10));
    expect(res.output.updatedAt).toBe(Date.UTC(2026, 8, 20, 10));
    expect(res.output.version).toBe(0);
  });

  test('legacy-запись с updatedAt (ISO) — число, createdAt не затронут', () => {
    const res = parse(legacy({ updatedAt: '2026-09-21T12:00' }));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.output.updatedAt).toBe(Date.UTC(2026, 8, 21, 12));
    expect(res.output.createdAt).toBe(Date.UTC(2026, 8, 20, 10));
  });

  test('новый формат (числа, version) читается без изменений', () => {
    const next = legacy({
      createdAt: Date.UTC(2026, 8, 20, 10),
      updatedAt: Date.UTC(2026, 8, 21, 12),
      expiresAt: Date.UTC(2026, 8, 27, 10),
      version: 3,
    });
    const res = parse(next);
    expect(res.success).toBe(true);
    if (res.success) expect(res.output).toEqual(next as never);
  });

  test('пустой participants — валиден (адресат только ментор)', () => {
    expect(parse(legacy({ participants: [] })).success).toBe(true);
  });
});

describe('ReviewCampaignState — форма (ФР-1, ФР-3)', () => {
  test.each([
    'completed_passed',
    'completed_not_passed',
    'dropped',
    'never_started',
  ])('исход %s принимается', (subjectOutcome) => {
    const payload = { subjectOutcome, mentorId: UUIDS.mentor };
    expect(parse(legacy({ payload })).success).toBe(true);
  });

  test.each(['in_progress', 'completed', 'advanced', 'abandoned'])(
    'исход %s отклоняется («ещё учится» и сырые статусы не хранятся)',
    (subjectOutcome) => {
      const payload = { subjectOutcome, mentorId: UUIDS.mentor };
      expect(parse(legacy({ payload })).success).toBe(false);
    },
  );

  test('контекст: stream_fate; прочее (в т.ч. старый stream_ended) отклоняется', () => {
    expect(parse(legacy({ context: 'stream_ended' })).success).toBe(false);
    expect(parse(legacy({ context: 'exit' })).success).toBe(false);
  });

  test('mentorId обязателен и UUID', () => {
    const outcome = 'completed_passed';
    expect(
      parse(legacy({ payload: { subjectOutcome: outcome, mentorId: 'x' } }))
        .success,
    ).toBe(false);
    expect(
      parse(legacy({ payload: { subjectOutcome: outcome } })).success,
    ).toBe(false);
  });

  test('participants — только uuid[] (списочная модель со статусами удалена)', () => {
    expect(parse(legacy({ participants: ['x'] })).success).toBe(false);
    expect(
      parse(
        legacy({ participants: [{ userId: UUIDS.user1, role: 'student' }] }),
      ).success,
    ).toBe(false);
  });

  test('uuid/scopeId/subjectId обязательны и UUID', () => {
    for (const key of ['uuid', 'scopeId', 'subjectId']) {
      expect(parse(legacy({ [key]: 'x' })).success).toBe(false);
      expect(parse(legacy({ [key]: undefined })).success).toBe(false);
    }
  });

  test('payload обязателен; дата не ISO отклоняется', () => {
    expect(parse(legacy({ payload: undefined })).success).toBe(false);
    expect(parse(legacy({ createdAt: '20.09.2026' })).success).toBe(false);
    expect(parse(legacy({ expiresAt: 'завтра' })).success).toBe(false);
  });

  test('у каждого поля (и payload) есть описание (MAN-02)', () => {
    for (const field of Object.values(ReviewCampaignState.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
    const payload = ReviewCampaignState.entries.payload;
    for (const field of Object.values(payload.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });
});

// Решение 13 брифа: ISO без зоны — UTC при любой TZ процесса. Раньше (new Date(строка)) —
// локальное время; тест защищает от смены TZ сервера.
describe('ReviewCampaignArDef.state — TZ процесса', () => {
  // Только в `bun run test:tz` (TZ=Asia/Oral): зона процесса не UTC.
  test('проба: при TZ=Asia/Oral локальное чтение сдвинуто (UTC+5)', () => {
    if (process.env.TZ !== 'Asia/Oral') return;
    expect(new Date('2026-09-27T10:00').getTime()).toBe(
      Date.UTC(2026, 8, 27, 5),
    );
  });

  test('ISO без зоны остаётся UTC, а не локальным временем', () => {
    const res = parse(legacy());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.output.createdAt).toBe(Date.UTC(2026, 8, 20, 10));
    expect(res.output.expiresAt).toBe(Date.UTC(2026, 8, 27, 10));
  });
});
