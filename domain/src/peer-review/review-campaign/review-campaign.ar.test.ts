import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { REVIEW_WINDOW_DAYS } from './constants';
import { ReviewCampaignAr } from './review-campaign.ar';
import { ReviewCampaignEvents } from './review-campaign.events';
import type { ReviewCampaignState } from './review-campaign.state';

const UUIDS = {
  campaign: '11111111-1111-4111-8111-111111111111',
  scope: '22222222-2222-4222-8222-222222222222',
  subject: '77777777-7777-4777-8777-777777777777',
  alice: '33333333-3333-4333-8333-333333333333',
  bob: '44444444-4444-4444-8444-444444444444',
  mentor: '55555555-5555-4555-8555-555555555555',
  stranger: '29999999-9999-4999-8999-999999999999',
};
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 20, 10);
const T7 = Date.UTC(2026, 8, 27, 10);

const stored = (
  over: Partial<ReviewCampaignState> = {},
): ReviewCampaignState => ({
  uuid: UUIDS.campaign,
  context: 'stream_fate',
  scopeId: UUIDS.scope,
  subjectId: UUIDS.subject,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  expiresAt: T7,
  participants: [UUIDS.alice, UUIDS.bob],
  payload: { subjectOutcome: 'completed_passed', mentorId: UUIDS.mentor },
  ...over,
});

const ar = (over: Partial<ReviewCampaignState> = {}) =>
  ReviewCampaignAr.restore(stored(over));

const input = (over: Record<string, unknown> = {}) => ({
  uuid: UUIDS.campaign,
  scopeId: UUIDS.scope,
  subjectId: UUIDS.subject,
  mentorId: UUIDS.mentor,
  subjectOutcome: 'completed_passed' as const,
  participantIds: [UUIDS.alice, UUIDS.bob],
  ...over,
});

describe('ReviewCampaignAr.create (бывш. ReviewCampaignFactory.createStudentCampaign)', () => {
  it('контекст stream_fate, скоуп, субъект, ментор, исход в payload; version 0', () => {
    const campaign = expectOk(ReviewCampaignAr.create(input(), T0));
    expect(campaign.snapshot()).toEqual({
      ...stored(),
      createdAt: T0,
      updatedAt: T0,
    });
    expect(campaign.scopeId).toBe(UUIDS.scope);
    expect(campaign.subjectId).toBe(UUIDS.subject);
    expect(campaign.mentorId).toBe(UUIDS.mentor);
    expect(campaign.subjectOutcome).toBe('completed_passed');

    const outcomes = [
      'completed_passed',
      'completed_not_passed',
      'dropped',
      'never_started',
    ] as const;
    for (const subjectOutcome of outcomes) {
      const created = expectOk(
        ReviewCampaignAr.create(input({ subjectOutcome }), T0),
      );
      expect(created.subjectOutcome).toBe(subjectOutcome);
    }
  });

  it(`expiresAt = at + ${REVIEW_WINDOW_DAYS.streamFate} суток (7), Date.now() не читается`, () => {
    expect(REVIEW_WINDOW_DAYS.streamFate).toBe(7);
    const campaign = expectOk(ReviewCampaignAr.create(input(), T0));
    expect(campaign.expiresAt).toBe(T0 + 7 * DAY);
    const later = expectOk(ReviewCampaignAr.create(input(), T0 + 123_456));
    expect(later.expiresAt).toBe(T0 + 123_456 + 7 * DAY);
  });

  it('участники: порядок сохранён; пустой список валиден (dropped/never_started)', () => {
    const empty = expectOk(
      ReviewCampaignAr.create(
        input({ subjectOutcome: 'dropped', participantIds: [] }),
        T0,
      ),
    );
    expect(empty.snapshot().participants).toEqual([]);
    const two = expectOk(ReviewCampaignAr.create(input(), T0));
    expect(two.snapshot().participants).toEqual([UUIDS.alice, UUIDS.bob]);
  });

  it('событие created из create: peer-review.review-campaign.created с полными данными для UI (ФР-5)', () => {
    const campaign = expectOk(ReviewCampaignAr.create(input(), T0));
    expect(campaign.pullEvents()).toEqual([
      ReviewCampaignEvents.created.make({
        campaignId: UUIDS.campaign,
        context: 'stream_fate',
        scopeId: UUIDS.scope,
        subjectId: UUIDS.subject,
        mentorId: UUIDS.mentor,
        subjectOutcome: 'completed_passed',
      }),
    ]);
    expect(campaign.pullEvents()).toEqual([]); // выдаётся единожды
  });

  it.each([
    [
      'субъект среди участников (не о себе)',
      { participantIds: [UUIDS.alice, UUIDS.subject] },
    ],
    [
      'ментор среди участников (ментор — в payload)',
      { participantIds: [UUIDS.mentor] },
    ],
    ['дубль среди участников', { participantIds: [UUIDS.alice, UUIDS.alice] }],
  ])('инвариант адресации: %s — Err, не исключение', (_label, over) => {
    const res = ReviewCampaignAr.create(input(over), T0);
    const error = expectErr(res, 'REVIEW_CAMPAIGN_INVALID_PARTICIPANTS');
    expect(error.kind).toBe('validation');
  });
});

describe('ReviewCampaignAr.restore', () => {
  it('участники нарушают инвариант адресации — исключение при restore', () => {
    expect(() => ar({ participants: [UUIDS.alice, UUIDS.alice] })).toThrow();
    expect(() => ar({ participants: [UUIDS.subject] })).toThrow();
    expect(() => ar({ participants: [UUIDS.mentor] })).toThrow();
  });
});

describe('ReviewCampaignAr: окно жизни', () => {
  it('до границы жива; за минуту до — жива', () => {
    expect(ar().isExpired(T0)).toBe(false);
    expect(ar().isExpired(T7 - 60_000)).toBe(false);
  });

  it('в момент границы окно закрыто (at >= expiresAt), после — тоже', () => {
    expect(ar().isExpired(T7)).toBe(true);
    expect(ar().isExpired(T7 + 60_000)).toBe(true);
  });

  it('daysLeft: в момент создания 7; через полдня 7 (вверх); <суток — 1; истёкшая — 0', () => {
    expect(ar().daysLeft(T0)).toBe(7);
    expect(ar().daysLeft(T0 + DAY / 2)).toBe(7);
    expect(ar().daysLeft(T7 - DAY / 2)).toBe(1);
    expect(ar().daysLeft(T7)).toBe(0);
    expect(ar().daysLeft(T7 + DAY)).toBe(0);
  });
});

describe('ReviewCampaignAr: вопросы о составе', () => {
  it('isSubject / isMentor / hasParticipant', () => {
    const c = ar();
    expect(c.isSubject(UUIDS.subject)).toBe(true);
    expect(c.isSubject(UUIDS.alice)).toBe(false);
    expect(c.isMentor(UUIDS.mentor)).toBe(true);
    expect(c.isMentor(UUIDS.subject)).toBe(false);
    expect(c.hasParticipant(UUIDS.alice)).toBe(true);
    expect(c.hasParticipant(UUIDS.stranger)).toBe(false);
  });
});

describe('ReviewCampaignAr: роль автора и адресаты (ФР-3)', () => {
  it('authorRoleOf: субъект, ментор; соученик и посторонний — не авторы', () => {
    const c = ar();
    expect(c.authorRoleOf(UUIDS.subject)).toBe('subject');
    expect(c.authorRoleOf(UUIDS.mentor)).toBe('mentor');
    expect(c.authorRoleOf(UUIDS.alice)).toBeUndefined();
    expect(c.authorRoleOf(UUIDS.stranger)).toBeUndefined();
  });

  it('targetIdsFor субъекта — соученики + ментор (порядок сохранён)', () => {
    const cases: [Partial<ReviewCampaignState>, string[]][] = [
      [{}, [UUIDS.alice, UUIDS.bob, UUIDS.mentor]],
      [{ participants: [] }, [UUIDS.mentor]],
    ];
    for (const [over, expected] of cases) {
      expect(ar(over).targetIdsFor(UUIDS.subject)).toEqual(expected);
    }
  });

  it('targetIdsFor ментора — единственный адресат субъект', () => {
    expect(ar().targetIdsFor(UUIDS.mentor)).toEqual([UUIDS.subject]);
  });

  it('соученик и посторонний не авторы окна — адресатов нет', () => {
    expect(ar().targetIdsFor(UUIDS.alice)).toEqual([]);
    expect(ar().targetIdsFor(UUIDS.stranger)).toEqual([]);
  });
});
