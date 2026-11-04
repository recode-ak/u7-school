import { describe, expect, mock, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { assertMarkdownV2Safe } from '@u7-scl/core/shared';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/user/domain';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { InactivityStory } from './inactivity.story';
import { dmgDispatch, streamNotFound, streamView } from './stream-dmg.test-kit';

// Подписки InactivityStory на Def-события студента (решение 17 брифа среза
// student). Адрес — по профилю через legacy `get-user` (вариант a),
// ментор — `getStream(streamId).mentorId`; Job и UC адресов не знают.
// События приходят в legacy-форме шины: `eventName` — FQN Def.
//   - inactivityWarning / inactivityRemoveCandidate: поле `days`;
//   - abandoned: кик + (self → ментору `info`) / (mentor + inactivity → студенту `warn`).

const STREAM_ID = '77777777-7777-4777-8777-777777777777';
const STUDENT_ROW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_USER = '11111111-1111-4111-8111-111111111111';
const MENTOR_USER = '66666666-6666-4666-8666-666666666666';
const GROUP = '-1002222222222';

const profile = (uuid: string, name: string, telegramId?: number): User =>
  ({
    uuid,
    name,
    telegramId,
    roles: [Role.STUDENT],
    createdAt: '2026-01-01T00:00',
  }) as User;
const users: Record<string, User> = {
  [STUDENT_USER]: profile(STUDENT_USER, 'Иван Студент', 1003),
  [MENTOR_USER]: profile(MENTOR_USER, 'Ментор', 1004),
};

const stream = streamView({
  uuid: STREAM_ID,
  title: 'JS Core — Поток 2',
  mentorId: MENTOR_USER,
  status: 'active',
  telegramGroupId: GROUP,
});

const eventOf = (name: string, payload: Record<string, unknown>) => ({
  eventId: crypto.randomUUID(),
  eventName: name,
  occurredAt: '2026-08-30T19:00',
  aggregateName: 'student',
  aggregateId: STUDENT_ROW,
  payload: {
    studentId: STUDENT_ROW,
    userId: STUDENT_USER,
    streamId: STREAM_ID,
    ...payload,
  },
});
const warning = (days = 5) =>
  eventOf(StudentEvents.inactivityWarning.name, { days });
const candidate = (days = 7, wasWarned = false) =>
  eventOf(StudentEvents.inactivityRemoveCandidate.name, { days, wasWarned });
const abandoned = (who: 'self' | 'mentor', cause: string) =>
  eventOf(StudentEvents.abandoned.name, { who, cause });

type Sent = {
  telegramId: number;
  payload: {
    text: unknown;
    kind?: string;
    keyboard?: { rows: Array<Array<{ text: string; code: string }>> };
  };
};

function setup(
  opts: { stream?: 'ok' | 'missing'; profiles?: Record<string, User> } = {},
) {
  const notifies: Sent[] = [];
  const invites: Sent[] = [];
  const kicks: Array<{ groupId: unknown; userId: number }> = [];
  const profiles = opts.profiles ?? users;
  const story = new InactivityStory();
  story.init(
    {
      appApi: {
        execute: mock(async (name: string, params?: Record<string, unknown>) =>
          name === 'get-user' ? profiles[params?.uuid as string] : undefined,
        ),
        dispatch: dmgDispatch({
          getStream: () =>
            opts.stream === 'missing' ? streamNotFound() : stream,
        }),
      },
      callers: testCallers,
    } as never,
    {
      notify: mock(async (telegramId: number, payload: Sent['payload']) => {
        notifies.push({ telegramId, payload });
      }),
      invite: mock(async (telegramId: number, payload: Sent['payload']) => {
        invites.push({ telegramId, payload });
      }),
      execute: mock(async () => {}),
      kickFromGroup: mock(async (groupId: unknown, userId: number) => {
        kicks.push({ groupId, userId });
      }),
    } as never,
  );
  const handle = async (e: { eventName: string }) => {
    const sub = story
      .getEventSubscriptions()
      .find((s) => s.eventName === e.eventName);
    if (!sub) throw new Error(`Подписка ${e.eventName} не найдена`);
    await sub.handle(e as never);
  };
  return { story, notifies, invites, kicks, handle };
}

describe('InactivityStory — подписки на Def-события', () => {
  test('три подписки на FQN Def, legacy-имён student.* нет', () => {
    const { story } = setup();
    const names = story
      .getEventSubscriptions()
      .map((s) => s.eventName)
      .sort();
    expect(names).toEqual(
      [
        StudentEvents.abandoned.name,
        StudentEvents.inactivityRemoveCandidate.name,
        StudentEvents.inactivityWarning.name,
      ].sort(),
    );
    expect(names.some((n) => n.startsWith('student.'))).toBe(false);
  });
});

describe('InactivityStory — inactivityWarning', () => {
  test('студенту invite с «🚪 Покинуть учёбу»; адрес из профиля, дни из payload.days', async () => {
    const { invites, notifies, handle } = setup();
    await handle(warning(5));

    expect(notifies).toHaveLength(0);
    expect(invites).toHaveLength(1);
    expect(invites[0]?.telegramId).toBe(1003);
    const text = String(invites[0]?.payload.text);
    expect(text).toContain('5 дней');
    expect(text).toContain('снять тебя с учёбы');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
    const btn = invites[0]?.payload.keyboard?.rows.flat()[0];
    expect(btn?.text).toBe('🚪 Покинуть учёбу');
    expect(btn?.code).toBe(`stream:inactivity:drop-student:${STUDENT_ROW}`);
  });

  test.each([
    ['профиля нет', {}],
    [
      'у профиля нет telegramId',
      { [STUDENT_USER]: profile(STUDENT_USER, 'Иван', undefined) },
    ],
  ])('%s — пропуск без исключения и без отправки', async (_, profiles) => {
    const { invites, handle } = setup({ profiles });
    await handle(warning());
    expect(invites).toHaveLength(0);
  });
});

describe('InactivityStory — inactivityRemoveCandidate', () => {
  test('ментору invite с «⚠️ Снять с учёбы»; ментор — из getStream, имя студента из профиля', async () => {
    const { invites, handle } = setup();
    await handle(candidate(7));

    expect(invites).toHaveLength(1);
    expect(invites[0]?.telegramId).toBe(1004);
    const text = String(invites[0]?.payload.text);
    expect(text).toContain('Иван Студент');
    expect(text).toContain('JS Core — Поток 2');
    expect(text).toContain('7 дней');
    expect(text).not.toContain('ранее отправлены');
    const btn = invites[0]?.payload.keyboard?.rows.flat()[0];
    expect(btn?.text).toBe('⚠️ Снять с учёбы');
    expect(btn?.code).toBe(`stream:inactivity:mark-abandoned:${STUDENT_ROW}`);
  });

  test('wasWarned → строка «Уведомления были ранее отправлены»', async () => {
    const { invites, handle } = setup();
    await handle(candidate(7, true));
    const text = String(invites[0]?.payload.text);
    expect(text).toContain('Уведомления были ранее отправлены');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
  });

  test('имя студента не резолвится → первые 8 символов userId', async () => {
    const { invites, handle } = setup({
      profiles: { [MENTOR_USER]: users[MENTOR_USER] as User },
    });
    await handle(candidate());
    expect(String(invites[0]?.payload.text)).toContain('11111111');
  });

  test('поток недоступен — ментор неизвестен, отправки нет', async () => {
    const { invites, handle } = setup({ stream: 'missing' });
    await handle(candidate());
    expect(invites).toHaveLength(0);
  });

  test('у ментора нет telegramId — отправки нет', async () => {
    const { invites, handle } = setup({
      profiles: { ...users, [MENTOR_USER]: profile(MENTOR_USER, 'Ментор') },
    });
    await handle(candidate());
    expect(invites).toHaveLength(0);
  });
});

describe('InactivityStory — abandoned', () => {
  test('кик из группы потока при любом уходе', async () => {
    for (const [who, cause] of [
      ['self', 'voluntary'],
      ['mentor', 'inactivity'],
      ['mentor', 'by_mentor'],
    ] as const) {
      const { kicks, handle } = setup();
      await handle(abandoned(who, cause));
      expect(kicks).toEqual([{ groupId: GROUP, userId: 1003 }]);
    }
  });

  test('self → ментору notify kind info «покинул учёбу … по собственному желанию»', async () => {
    const { notifies, handle } = setup();
    await handle(abandoned('self', 'voluntary'));

    expect(notifies).toHaveLength(1);
    expect(notifies[0]?.telegramId).toBe(1004);
    expect(notifies[0]?.payload.kind).toBe('info');
    const text = String(notifies[0]?.payload.text);
    expect(text).toContain('Иван Студент');
    expect(text).toContain('покинул учёбу');
    expect(text).toContain('JS Core — Поток 2');
    expect(text).toContain('по собственному желанию');
  });

  test('mentor + inactivity → студенту notify kind warn «снят с учёбы … за бездействие»', async () => {
    const { notifies, handle } = setup();
    await handle(abandoned('mentor', 'inactivity'));

    expect(notifies).toHaveLength(1);
    expect(notifies[0]?.telegramId).toBe(1003);
    expect(notifies[0]?.payload.kind).toBe('warn');
    const text = String(notifies[0]?.payload.text);
    expect(text).toContain('снят с учёбы');
    expect(text).toContain('за бездействие');
    expect(text).toContain('JS Core — Поток 2');
  });

  test('mentor + by_mentor → студенту текста нет (Т6), кик есть', async () => {
    const { notifies, kicks, handle } = setup();
    await handle(abandoned('mentor', 'by_mentor'));

    expect(notifies).toHaveLength(0);
    expect(kicks).toHaveLength(1);
  });

  test('поток недоступен — уведомление пропущено, исключения нет', async () => {
    const { notifies, kicks, handle } = setup({ stream: 'missing' });
    await handle(abandoned('self', 'voluntary'));
    expect(notifies).toHaveLength(0);
    expect(kicks).toHaveLength(0);
  });

  test('у студента нет telegramId — кика нет; уведомление студенту невозможно', async () => {
    const { notifies, kicks, handle } = setup({
      profiles: { ...users, [STUDENT_USER]: profile(STUDENT_USER, 'Иван') },
    });
    await handle(abandoned('mentor', 'inactivity'));
    expect(kicks).toHaveLength(0);
    expect(notifies).toHaveLength(0);
  });
});
