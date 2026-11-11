import { describe, expect, mock, test } from 'bun:test';
import { assertMarkdownV2Safe, type MdText } from '@u7-scl/core/shared';
import { BotRequestContext } from '@u7-scl/core/ui';
import { ReviewEvents } from '@u7-scl/domain/peer-review/contract';
import {
  GetUsersByIdsUcDef,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import { peerReviewDispatch, testCallers } from './peer-review-dmg.test-kit';
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

type Profile = UserView;
const user = (uuid: string, name: string, telegramId: number): Profile => ({
  uuid,
  name,
  telegramId,
  roles: ['GUEST'],
  createdAt: 1,
  updatedAt: 1,
  version: 0,
});

interface Sent {
  telegramId: number;
  payload: { text: MdText; kind?: string };
}

function setupStory(profiles: Profile[]) {
  const sent: Sent[] = [];
  const warns: unknown[][] = [];
  const dispatch = peerReviewDispatch({
    getUsersByIds: (input) => {
      const ids = (input as { userIds: string[] }).userIds;
      return profiles.filter((p) => ids.includes(p.uuid));
    },
  });
  const story = new ReviewNotifyStory();
  story.init(
    { appApi: { dispatch }, callers: testCallers } as never,
    {
      notify: mock(async (telegramId: number, payload: Sent['payload']) => {
        sent.push({ telegramId, payload });
      }),
      invite: mock(async () => {}),
    } as never,
  );
  Object.defineProperty(story, 'logger', {
    get: () => ({ warn: (...a: unknown[]) => warns.push(a) }),
  });
  return { story, sent, warns, dispatch };
}

function handler(story: ReviewNotifyStory) {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.eventName === 'peer-review.review.created');
  if (!sub) throw new Error('Подписка peer-review.review.created не найдена');
  return sub.handle as (event: ReviewCreatedEvent) => Promise<void>;
}

/** Подписка в контексте апдейта Telegram: `requestId` для следа вызовов UC. */
async function run(
  story: ReviewNotifyStory,
  event: ReviewCreatedEvent,
): Promise<void> {
  await BotRequestContext.run(1, () => handler(story)(event));
}

describe('ReviewNotifyStory — уведомление адресату о новом отзыве', () => {
  test('соученик написал: уведомление адресату с именем и ролью автора', async () => {
    const { story, sent, warns } = setupStory([
      user(ALICE, 'Алиса', 101),
      user(BOB, 'Боб', 202),
    ]);

    await run(story, createdEvent('student_student'));

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

    await run(story, createdEvent('student_mentor', { recipientId: MENTOR }));

    expect(sent[0]?.telegramId).toBe(303);
    expect(String(sent[0]?.payload.text)).toContain('твой студент');
  });

  test('ментор написал студенту: роль «твой ментор»', async () => {
    const { story, sent } = setupStory([
      user(MENTOR, 'Ментор', 303),
      user(ALICE, 'Алиса', 101),
    ]);

    await run(
      story,
      createdEvent('mentor_student', { authorId: MENTOR, recipientId: ALICE }),
    );

    expect(sent[0]?.telegramId).toBe(101);
    expect(String(sent[0]?.payload.text)).toContain('твой ментор');
  });

  test('имена автора и адресата — один batch-запрос getUsersByIds', async () => {
    const { story, dispatch } = setupStory([
      user(ALICE, 'Алиса', 101),
      user(BOB, 'Боб', 202),
    ]);

    await run(story, createdEvent('student_student'));

    expect(dispatch.mock.calls).toHaveLength(1);
    const [module, command] = dispatch.mock.calls[0] as unknown as [
      unknown,
      { uc: string; input: { userIds: string[] } },
    ];
    expect(module).toBe(UserModuleDef);
    expect(command.uc).toBe(GetUsersByIdsUcDef.name);
    expect([...command.input.userIds].sort()).toEqual([ALICE, BOB].sort());
  });

  test.each<[string, Profile[]]>([
    ['автор не найден', [user(BOB, 'Боб', 202)]],
    ['адресат не найден', [user(ALICE, 'Алиса', 101)]],
  ])('%s — предупреждение, сообщение не отправляется', async (_, profiles) => {
    const { story, sent, warns } = setupStory(profiles);

    await run(story, createdEvent('student_student'));

    expect(sent).toHaveLength(0);
    expect(warns).toHaveLength(1);
  });
});
