import { describe, expect, mock, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { assertMarkdownV2Safe, type MdText } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  NotificationPayload,
} from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/user/domain';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { InactivityStory } from './inactivity.story';
import {
  dmgDispatch,
  refuse,
  streamNotFound,
  streamView,
} from './stream-dmg.test-kit';
import { studentView } from './student-dmg.test-kit';

// ══ Фикстуры ══

const STREAM_ID = '77777777-7777-4777-8777-777777777777';
const STUDENT_USER_ID = '11111111-1111-4111-8111-111111111111';
const MENTOR_USER_ID = '66666666-6666-4666-8666-666666666666';
const GROUP_ID = '-1002222222222';

const student: User = {
  uuid: STUDENT_USER_ID,
  name: 'Иван Студент',
  telegramId: 1003,
  roles: [Role.STUDENT],
  createdAt: '2026-01-01T00:00',
};

const stream = streamView({
  uuid: STREAM_ID,
  schoolId: 'a0000000-0000-4000-8000-000000000001',
  title: 'JS Core — Поток 2',
  description: 'Второй поток',
  mentorId: MENTOR_USER_ID,
  moduleId: '44444444-4444-4444-8444-444444444444',
  startDate: Date.parse('2026-06-01T00:00'),
  status: 'active',
});

/** Профиль, который вернёт `get-user`; `telegramId` может отсутствовать */
type ProfileOverride = Omit<User, 'telegramId'> & { telegramId?: number };

/** Профили, которые возвращает `get-user` по умолчанию */
const PROFILES: Record<string, ProfileOverride | undefined> = {
  [STUDENT_USER_ID]: student,
  [MENTOR_USER_ID]: {
    ...student,
    uuid: MENTOR_USER_ID,
    name: 'Ментор',
    telegramId: 1004,
  },
};

function makeWarningEvent(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    eventId: crypto.randomUUID(),
    eventName: StudentEvents.inactivityWarning.name,
    occurredAt: '2026-08-30T19:00',
    aggregateName: 'Student',
    aggregateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payload: {
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: STUDENT_USER_ID,
      streamId: STREAM_ID,
      days: 5,
      ...overrides,
    },
  };
}

function makeCandidateEvent(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    eventId: crypto.randomUUID(),
    eventName: StudentEvents.inactivityRemoveCandidate.name,
    occurredAt: '2026-08-30T19:00',
    aggregateName: 'Student',
    aggregateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payload: {
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: STUDENT_USER_ID,
      streamId: STREAM_ID,
      days: 7,
      wasWarned: false,
      ...overrides,
    },
  };
}

function makeAbandonedEvent(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    eventId: crypto.randomUUID(),
    eventName: StudentEvents.abandoned.name,
    occurredAt: '2026-08-30T19:00',
    aggregateName: 'Student',
    aggregateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payload: {
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: STUDENT_USER_ID,
      streamId: STREAM_ID,
      who: 'self',
      cause: 'voluntary',
      ...overrides,
    },
  };
}

// ══ Сборка стори с моками ══

function setupStory(
  opts: {
    streamOverrides?: Record<string, unknown>;
    stream?: 'ok' | 'missing';
    profiles?: Record<string, ProfileOverride | undefined>;
  } = {},
): {
  story: InactivityStory;
  notifies: Array<{ telegramId: number; payload: NotificationPayload }>;
  invites: Array<{
    telegramId: number;
    payload: {
      text: MdText;
      keyboard: { rows: Array<Array<{ text: string; code: string }>> };
    };
  }>;
  kicks: Array<{ groupId: number | string; userId: number }>;
  execute: ReturnType<typeof mock>;
  dispatch: ReturnType<typeof dmgDispatch>;
} {
  const notifies: Array<{
    telegramId: number;
    payload: NotificationPayload;
  }> = [];
  const invites: Array<{
    telegramId: number;
    payload: {
      text: MdText;
      keyboard: { rows: Array<Array<{ text: string; code: string }>> };
    };
  }> = [];
  const kicks: Array<{ groupId: number | string; userId: number }> = [];
  const execute = mock(
    async (name: string, params?: Record<string, unknown>) =>
      name === 'get-user'
        ? (opts.profiles ?? PROFILES)[params?.uuid as string]
        : undefined,
  );
  const dispatch = dmgDispatch({
    getStream: () =>
      opts.stream === 'missing'
        ? streamNotFound()
        : { ...stream, ...opts.streamOverrides },
    // Запись студента есть только у aaaaaaaa…, остальные — не найдены
    getStudentProgress: (input) => {
      const sid = (input as { studentId: string }).studentId;
      return sid === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        ? {
            student: studentView({
              uuid: sid,
              userId: STUDENT_USER_ID,
              streamId: STREAM_ID,
              status: 'active',
              currentStepId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              steps: [],
            }),
          }
        : refuse('STUDENT_NOT_FOUND', 'not_found');
    },
    dropStudent: () => ({}),
    markAbandoned: () => ({}),
  });

  const story = new InactivityStory();
  story.init(
    {
      appApi: {
        execute,
        dispatch,
      },
      callers: testCallers,
    } as never,
    {
      notify: mock(async (telegramId: number, payload: NotificationPayload) => {
        notifies.push({ telegramId, payload });
      }),
      invite: mock(
        async (
          telegramId: number,
          payload: {
            text: MdText;
            keyboard: { rows: Array<Array<{ text: string; code: string }>> };
          },
        ) => {
          invites.push({ telegramId, payload });
        },
      ),
      execute: mock(
        async (action: {
          kind: string;
          chatId: number | string;
          userId: number;
        }) => {
          if (action.kind === 'kick_member') {
            kicks.push({ groupId: action.chatId, userId: action.userId });
          }
        },
      ),
      kickFromGroup: mock(async (groupId: number | string, userId: number) => {
        kicks.push({ groupId, userId });
      }),
    } as never,
  );

  return { story, notifies, invites, kicks, execute, dispatch };
}

/** Достаёт обработчик подписки по имени события */
function subHandler(
  story: InactivityStory,
  eventName: string,
): (event: never) => Promise<void> {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.eventName === eventName);
  if (!sub) throw new Error(`Подписка ${eventName} не найдена`);
  return sub.handle as (event: never) => Promise<void>;
}

describe('InactivityStory', () => {
  // ── Подписки ──

  test('подписки на FQN Def, legacy-имён student.* нет', () => {
    const { story } = setupStory();
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

  // ── Предупреждение студенту (FR-1, 5+ дней) ──

  test('warning → студенту invite с кнопкой «🚪 Покинуть учёбу»', async () => {
    const { story, invites, notifies } = setupStory();

    await subHandler(
      story,
      StudentEvents.inactivityWarning.name,
    )(makeWarningEvent() as never);

    // Кнопочный проактив — канал invite (не notify)
    expect(notifies).toHaveLength(0);
    expect(invites).toHaveLength(1);
    expect(invites[0]?.telegramId).toBe(1003);
    const text = String(invites[0]?.payload.text);
    expect(text).toContain('5 дней');
    expect(text).toContain('снять тебя с учёбы');
    expect(text).not.toContain('/start');
    // Кнопка самовыхода: в drop-student confirm этой же стори
    const btns = invites[0]?.payload.keyboard.rows.flat() ?? [];
    expect(btns).toHaveLength(1);
    expect(btns[0]?.text).toBe('🚪 Покинуть учёбу');
    // Полный путь (кросс-диалоговый invite-канал, как в Routes.stream)
    expect(btns[0]?.code).toBe(
      'stream:inactivity:drop-student:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  test('warning: текст валиден для MarkdownV2', async () => {
    const { story, invites } = setupStory();

    await subHandler(
      story,
      StudentEvents.inactivityWarning.name,
    )(makeWarningEvent() as never);

    expect(() =>
      assertMarkdownV2Safe(String(invites[0]?.payload.text)),
    ).not.toThrow();
  });

  test.each([
    ['профиля нет', {}],
    [
      'у профиля нет telegramId',
      { [STUDENT_USER_ID]: { ...student, telegramId: undefined } },
    ],
  ])('%s — пропуск без исключения и без отправки', async (_, profiles) => {
    const { story, invites } = setupStory({ profiles });

    await subHandler(
      story,
      StudentEvents.inactivityWarning.name,
    )(makeWarningEvent() as never);

    expect(invites).toHaveLength(0);
  });

  // ── Уведомление ментору (FR-1, 7+ дней) ──

  test('candidate → ментору invite с кнопкой «⚠️ Снять с учёбы»', async () => {
    const { story, invites, notifies } = setupStory();

    await subHandler(
      story,
      StudentEvents.inactivityRemoveCandidate.name,
    )(makeCandidateEvent() as never);

    // Кнопочный проактив — канал invite (не notify)
    expect(notifies).toHaveLength(0);
    expect(invites).toHaveLength(1);
    expect(invites[0]?.telegramId).toBe(1004);
    const text = String(invites[0]?.payload.text);
    // доменные данные экранированы md-интерполяцией — литерал без спецсимволов
    expect(text).toContain('Иван Студент');
    expect(text).toContain('JS Core — Поток 2');
    expect(text).toContain('7 дней');
    expect(text).not.toContain('ранее отправлены');
    expect(text).not.toContain('Действия по студенту');
    // Кнопка снятия: в mark-abandoned confirm этой же стори
    const btns = invites[0]?.payload.keyboard.rows.flat() ?? [];
    expect(btns).toHaveLength(1);
    expect(btns[0]?.text).toBe('⚠️ Снять с учёбы');
    expect(btns[0]?.code).toBe(
      'stream:inactivity:mark-abandoned:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  test('candidate с wasWarned → строка «уведомления были ранее отправлены»', async () => {
    const { story, invites } = setupStory();

    await subHandler(
      story,
      StudentEvents.inactivityRemoveCandidate.name,
    )(makeCandidateEvent({ wasWarned: true }) as never);

    const text = String(invites[0]?.payload.text);
    expect(text).toContain('Уведомления были ранее отправлены');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
  });

  test('candidate: имя не резолвится → fallback, первые 8 символов userId', async () => {
    const { story, invites } = setupStory();

    await subHandler(
      story,
      StudentEvents.inactivityRemoveCandidate.name,
    )(
      makeCandidateEvent({
        userId: '99999999-9999-4999-8999-999999999999',
      }) as never,
    );

    const text = String(invites[0]?.payload.text);
    expect(text).toContain('99999999');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
  });

  test('candidate: поток недоступен — ментор неизвестен, отправки нет', async () => {
    const { story, invites } = setupStory({ stream: 'missing' });

    await subHandler(
      story,
      StudentEvents.inactivityRemoveCandidate.name,
    )(makeCandidateEvent() as never);

    expect(invites).toHaveLength(0);
  });

  test('candidate: у ментора нет telegramId — отправки нет', async () => {
    const { story, invites } = setupStory({
      profiles: {
        [STUDENT_USER_ID]: student,
        [MENTOR_USER_ID]: {
          ...student,
          uuid: MENTOR_USER_ID,
          name: 'Ментор',
          telegramId: undefined,
        },
      },
    });

    await subHandler(
      story,
      StudentEvents.inactivityRemoveCandidate.name,
    )(makeCandidateEvent() as never);

    expect(invites).toHaveLength(0);
  });

  // ── События ухода (кик; текстовые уведомления — в UC) ──

  test('abandoned → мягкий кик из группы потока (FR-6)', async () => {
    const { story, kicks } = setupStory({
      streamOverrides: { telegramGroupId: GROUP_ID },
    });

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent() as never);

    expect(kicks).toHaveLength(1);
    expect(kicks[0]).toEqual({ groupId: GROUP_ID, userId: 1003 });
  });

  test('abandoned: у потока нет группы — кик не вызывается, ошибок нет', async () => {
    const { story, kicks } = setupStory();

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent() as never);

    expect(kicks).toHaveLength(0);
  });

  test('abandoned: у студента нет telegramId — кик не вызывается', async () => {
    const { story, kicks } = setupStory({
      streamOverrides: { telegramGroupId: GROUP_ID },
    });

    // get-user вернул студента без telegramId — кику некому
    const userWithoutTg = { ...student, telegramId: undefined };
    story.init({
      appApi: {
        execute: mock(async (name: string) => {
          if (name === 'get-user') return userWithoutTg;
          return undefined;
        }),
        dispatch: dmgDispatch({
          getStream: () => ({ ...stream, telegramGroupId: GROUP_ID }),
        }),
      },
      callers: testCallers,
    } as never);

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent() as never);

    expect(kicks).toHaveLength(0);
  });

  test('abandoned: у студента нет telegramId — уведомление студенту невозможно', async () => {
    const { story, kicks, notifies } = setupStory({
      profiles: { [STUDENT_USER_ID]: { ...student, telegramId: undefined } },
    });

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent({ who: 'mentor', cause: 'inactivity' }) as never);

    expect(kicks).toHaveLength(0);
    expect(notifies).toHaveLength(0);
  });

  test('abandoned: self — ментору notify kind info «покинул учёбу … по собственному желанию»', async () => {
    const { story, notifies } = setupStory();

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent() as never);

    expect(notifies).toHaveLength(1);
    expect(notifies[0]?.telegramId).toBe(1004);
    expect(notifies[0]?.payload.kind).toBe('info');
    const text = String(notifies[0]?.payload.text);
    expect(text).toContain('Иван Студент');
    expect(text).toContain('покинул учёбу');
    expect(text).toContain('JS Core — Поток 2');
    expect(text).toContain('по собственному желанию');
  });

  test('abandoned: mentor + inactivity — студенту notify kind warn «снят с учёбы … за бездействие»', async () => {
    const { story, notifies } = setupStory();

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent({ who: 'mentor', cause: 'inactivity' }) as never);

    expect(notifies).toHaveLength(1);
    expect(notifies[0]?.telegramId).toBe(1003);
    expect(notifies[0]?.payload.kind).toBe('warn');
    const text = String(notifies[0]?.payload.text);
    expect(text).toContain('снят с учёбы');
    expect(text).toContain('за бездействие');
    expect(text).toContain('JS Core — Поток 2');
  });

  test('abandoned: mentor + by_mentor — студенту текста нет (Т6), кик есть', async () => {
    const { story, notifies, kicks } = setupStory({
      streamOverrides: { telegramGroupId: GROUP_ID },
    });

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent({ who: 'mentor', cause: 'by_mentor' }) as never);

    expect(notifies).toHaveLength(0);
    expect(kicks).toHaveLength(1);
  });

  test('abandoned: поток недоступен — уведомления и кика нет, исключения нет', async () => {
    const { story, notifies, kicks } = setupStory({ stream: 'missing' });

    await subHandler(
      story,
      StudentEvents.abandoned.name,
    )(makeAbandonedEvent() as never);

    expect(notifies).toHaveLength(0);
    expect(kicks).toHaveLength(0);
  });

  // ── Callback: кнопочные сценарии (FR-4/FR-5) ──

  const SESSION = {
    dialog: { path: 'streams/inactivity', seq: 1 },
  } as BotSession;

  function buttonCodes(
    response: DialogResponse,
  ): Array<{ text: string; code: string }> {
    return response.screen?.keyboard?.rows.flat() ?? [];
  }

  test('drop-student: confirm-диалог «Покинуть учёбу?» с возвратом в меню', async () => {
    const { story } = setupStory();

    const response = await story.handleCallback(
      `drop-student:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      student,
      SESSION,
    );

    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('Покинуть учёбу?');
    expect(String(response.screen?.text)).toContain('Прогресс сохранится');
    const btns = buttonCodes(response);
    expect(btns).toEqual([
      {
        text: '🚪 Да, покинуть',
        code: 'inactivity:drop-student-confirm:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      { text: '❌ Остаться', code: 'app:main-menu' },
    ]);
  });

  test('drop-student-confirm: UC dropStudent + прощание и выход в меню', async () => {
    const { story, dispatch } = setupStory({
      streamOverrides: { telegramGroupId: GROUP_ID },
    });

    const response = await story.handleCallback(
      `drop-student-confirm:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      student,
      SESSION,
    );

    assertDialogResponseMarkdownSafe(response);
    const dropCall = dispatch.mock.calls.find((c) => c[1].uc === 'dropStudent');
    expect(dropCall?.[1].input).toEqual({
      streamId: STREAM_ID,
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(String(response.screen?.text)).toContain('Ты покинул учёбу');
    expect(buttonCodes(response)).toEqual([
      { text: '⬅️ В меню', code: 'app:main-menu' },
    ]);
  });

  test('mark-abandoned: confirm-диалог снятия с возвратом в меню', async () => {
    const { story, dispatch } = setupStory();

    const response = await story.handleCallback(
      `mark-abandoned:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      student,
      SESSION,
    );

    assertDialogResponseMarkdownSafe(response);
    const progressCall = dispatch.mock.calls.find(
      (c) => c[1].uc === 'getStudentProgress',
    );
    expect(progressCall?.[1].input).toEqual({
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(String(response.screen?.text)).toContain(
      'Снять студента *Иван Студент*',
    );
    expect(String(response.screen?.text)).toContain(
      'исключён из группы потока',
    );
    const btns = buttonCodes(response);
    expect(btns).toEqual([
      {
        text: '⚠️ Да, снять с учёбы',
        code: 'inactivity:mark-abandoned-confirm:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      { text: '❌ Отмена', code: 'app:main-menu' },
    ]);
  });

  test('mark-abandoned: студент не найден — экран «Запись студента не найдена»', async () => {
    const { story } = setupStory();

    const response = await story.handleCallback(
      `mark-abandoned:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
      student,
      SESSION,
    );

    expect(String(response.screen?.text)).toContain(
      'Запись студента не найдена',
    );
  });

  test('mark-abandoned-confirm: UC markAbandoned cause=inactivity + реплика результата', async () => {
    const { story, dispatch } = setupStory();

    const response = await story.handleCallback(
      `mark-abandoned-confirm:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      student,
      SESSION,
    );

    assertDialogResponseMarkdownSafe(response);
    const markCall = dispatch.mock.calls.find(
      (c) => c[1].uc === 'markAbandoned',
    );
    expect(markCall?.[1].input).toEqual({
      streamId: STREAM_ID,
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      cause: 'inactivity',
    });
    expect(String(response.screen?.text)).toContain(
      'снят с учёбы за бездействие и исключён из группы потока',
    );
    expect(buttonCodes(response)).toEqual([]);
  });

  test('drop-student-confirm: ошибка UC — экран ошибки с выходом в меню', async () => {
    const { story } = setupStory();
    // getStudentProgress для несуществующего студента отказывает —
    // #getStudent возвращает undefined → экран «не найдена» (без UC-вызова)
    const response = await story.handleCallback(
      `drop-student-confirm:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
      student,
      SESSION,
    );

    expect(String(response.screen?.text)).toContain(
      'Запись студента не найдена',
    );
  });
});
