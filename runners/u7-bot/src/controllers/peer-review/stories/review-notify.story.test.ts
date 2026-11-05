import { describe, expect, mock, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { assertMarkdownV2Safe, type MdText } from '@u7-scl/core/shared';
import { ReviewEvents } from '@u7-scl/domain/peer-review/contract';
import {
  type ReviewCreatedEvent,
  ReviewNotifyStory,
} from './review-notify.story';

// Перенос `notify-review-recipient-er.test.ts` (5): ER снят, уведомление —
// подписка story на peer-review.review.created (образец — invite.story).

const SCOPE = '11111111-1111-4111-8111-111111111111';
const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '24444444-4444-4444-8444-444444444444';
const MENTOR = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN_ID = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REVIEW_ID = '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createdEvent(
  direction: ReviewCreatedEvent['payload']['direction'],
  overrides: Partial<ReviewCreatedEvent['payload']> = {},
): ReviewCreatedEvent {
  return {
    eventId: crypto.randomUUID(),
    eventName: ReviewEvents.created.name,
    occurredAt: '2026-09-20T10:00',
    aggregateName: 'Review',
    aggregateId: REVIEW_ID,
    payload: {
      reviewId: REVIEW_ID,
      campaignId: CAMPAIGN_ID,
      scopeId: SCOPE,
      authorId: ALICE,
      recipientId: BOB,
      direction,
      ...overrides,
    },
  };
}

type Profile = Omit<User, 'telegramId'> & { telegramId?: number };
const user = (uuid: string, name: string, telegramId?: number): Profile => ({
  uuid,
  name,
  ...(telegramId !== undefined ? { telegramId } : {}),
  roles: [],
  createdAt: '2026-01-01T00:00',
});

interface Sent {
  telegramId: number;
  payload: { text: MdText; kind?: string };
}

function setupStory(profiles: Profile[]) {
  const sent: Sent[] = [];
  const warns: unknown[][] = [];
  const execute = mock(
    async (name: string, params?: Record<string, unknown>) => {
      if (name === 'get-users-by-ids') {
        const ids = (params?.userIds ?? []) as string[];
        return profiles.filter((p) => ids.includes(p.uuid));
      }
      return undefined;
    },
  );
  const story = new ReviewNotifyStory();
  Object.assign(story, {
    appApi: { execute },
    proactiveSender: {
      notify: mock(async (telegramId: number, payload: Sent['payload']) => {
        sent.push({ telegramId, payload });
      }),
      invite: mock(async () => {}),
    },
  } as unknown);
  Object.defineProperty(story, 'logger', {
    get: () => ({ warn: (...a: unknown[]) => warns.push(a) }),
  });
  return { story, sent, warns, execute };
}

function handler(story: ReviewNotifyStory) {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.eventName === 'peer-review.review.created');
  if (!sub) throw new Error('Подписка peer-review.review.created не найдена');
  return sub.handle as (event: ReviewCreatedEvent) => Promise<void>;
}

describe('ReviewNotifyStory — уведомление адресату о новом отзыве', () => {
  test('соученик написал: уведомление адресату с именем и ролью автора', async () => {
    const { story, sent, warns } = setupStory([
      user(ALICE, 'Алиса', 101),
      user(BOB, 'Боб', 202),
    ]);

    await handler(story)(createdEvent('student_student'));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.telegramId).toBe(202);
    expect(sent[0]?.payload.kind ?? 'notify').toBe('notify');
    assertMarkdownV2Safe(sent[0]!.payload.text);
    const text = String(sent[0]?.payload.text);
    expect(text).toContain('Алиса');
    expect(text).toContain('твой соученик');
    expect(text).toContain('новый отзыв');
    expect(warns).toHaveLength(0);
  });

  test('студент написал ментору: роль «твой студент»', async () => {
    const { story, sent } = setupStory([
      user(ALICE, 'Алиса', 101),
      user(MENTOR, 'Ментор', 303),
    ]);

    await handler(story)(
      createdEvent('student_mentor', { recipientId: MENTOR }),
    );

    expect(sent[0]?.telegramId).toBe(303);
    expect(String(sent[0]?.payload.text)).toContain('твой студент');
  });

  test('ментор написал студенту: роль «твой ментор»', async () => {
    const { story, sent } = setupStory([
      user(MENTOR, 'Ментор', 303),
      user(ALICE, 'Алиса', 101),
    ]);

    await handler(story)(
      createdEvent('mentor_student', { authorId: MENTOR, recipientId: ALICE }),
    );

    expect(sent[0]?.telegramId).toBe(101);
    expect(String(sent[0]?.payload.text)).toContain('твой ментор');
  });

  test('имена автора и адресата — один batch-запрос get-users-by-ids', async () => {
    const { story, execute } = setupStory([
      user(ALICE, 'Алиса', 101),
      user(BOB, 'Боб', 202),
    ]);

    await handler(story)(createdEvent('student_student'));

    const calls = execute.mock.calls.filter((c) => c[0] === 'get-users-by-ids');
    expect(calls).toHaveLength(1);
    const input = calls[0]?.[1] as { userIds: string[] };
    expect([...input.userIds].sort()).toEqual([ALICE, BOB].sort());
  });

  test.each<[string, Profile[]]>([
    [
      'у адресата нет telegramId',
      [user(ALICE, 'Алиса', 101), user(BOB, 'Боб')],
    ],
    ['автор не найден', [user(BOB, 'Боб', 202)]],
    ['адресат не найден', [user(ALICE, 'Алиса', 101)]],
  ])('%s — предупреждение, сообщение не отправляется', async (_, profiles) => {
    const { story, sent, warns } = setupStory(profiles);

    await handler(story)(createdEvent('student_student'));

    expect(sent).toHaveLength(0);
    expect(warns).toHaveLength(1);
  });
});
