import { describe, expect, mock, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef, StudentEvents } from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/user/domain';
import {
  dmgDispatch,
  moduleNotFound,
  refuse,
} from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import {
  type LegacyStudent,
  studentAnswers,
  studentView,
} from '../../streams/stories/student-dmg.test-kit';
import { HubStory } from './hub';

/** Модули, которые вызывает хаб: курсы (место модуля) и потоки. */
const MODULES = [CourseModuleDef, StreamModuleDef];

describe('HubStory', () => {
  const session: BotSession = { dialog: { path: 'learning/hub', seq: 1 } };

  const studentActor: User = {
    uuid: 'user-1',
    name: 'Студент',
    telegramId: 123,
    roles: [Role.GUEST],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const guestActor: User = {
    uuid: 'user-2',
    name: 'Гость',
    telegramId: 456,
    roles: [Role.GUEST],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const STREAM_ID = '11111111-1111-4111-8111-111111111111';

  const mockStudent: LegacyStudent = {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
    streamId: STREAM_ID,
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    enrolledAt: '2026-01-01T00:00',
    status: 'active',
    currentStepId: 'cccc0000-0000-4000-8000-000000000001',
    steps: [
      {
        stepId: 'cccc0000-0000-4000-8000-000000000001',
        status: 'completed',
        issuedAt: '2026-01-02T00:00',
        completedAt: '2026-01-03T00:00',
      },
    ],
    createdAt: '2026-01-01T00:00',
  };

  /**
   * Хаб с замоканным `dispatch`. Ключи `overrides`: `get-student-by-user` —
   * запись студента (функция — студент не найден), `drop-student` — ответ
   * `dropStudent` (по умолчанию успех).
   */
  function makeStory(overrides?: Record<string, unknown>) {
    const studentOverride = overrides?.['get-student-by-user'];
    const student =
      typeof studentOverride === 'function'
        ? undefined
        : ((studentOverride ?? mockStudent) as LegacyStudent);
    const dispatch = dmgDispatch(
      {
        ...studentAnswers(student, []),
        getActiveStudent: (_input, caller) =>
          student && caller.subject().uuid === studentActor.uuid
            ? { student: studentView(student) }
            : {},
        dropStudent: () => overrides?.['drop-student'] ?? {},
      },
      MODULES,
    );

    const story = new HubStory();
    story.init({
      appApi: { execute: mock(() => undefined), dispatch },
      callers: testCallers,
    } as never);
    return { story, dispatch };
  }

  test('my-study — экран хаба с кнопками', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      'my-study',
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Моя учёба');

    const btns = response.screen?.keyboard?.rows.flat() ?? [];
    const btnTexts = btns.map((b) => b.text);
    expect(btnTexts.some((t) => t.includes('Продолжить учёбу'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Программа модуля'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Мой прогресс'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Покинуть учёбу'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Главное меню'))).toBe(true);

    // Коды навигации — мосты в стори контроллера (§3 И1–И2)
    const cont = btns.find((b) => b.text.includes('Продолжить учёбу'));
    expect(cont?.code).toBe('step-view:my-study:continue');
    const lessons = btns.find((b) => b.text.includes('Программа модуля'));
    expect(lessons?.code).toBe('nav-tree:my-study:lessons');
    const progress = btns.find((b) => b.text.includes('Мой прогресс'));
    expect(progress?.code).toBe(`progress:progress:${STREAM_ID}`);
  });

  test('my-study — студент не записан', async () => {
    const { story } = makeStory({
      'get-student-by-user': (() => {
        throw new Error('not found');
      }) as unknown,
    });

    const response = await story.handleCallback(
      'my-study',
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('не записаны');
  });

  test('my-study — завершивший студент (без Продолжить и Программа модуля)', async () => {
    const { story } = makeStory({
      'get-student-by-user': { ...mockStudent, status: 'advanced' },
    });

    const response = await story.handleCallback(
      'my-study',
      studentActor,
      session,
    );

    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Продолжить'))).toBe(false);
    expect(btnTexts.some((t) => t.includes('Программа модуля'))).toBe(false);
    expect(btnTexts.some((t) => t.includes('Мой прогресс'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Покинуть учёбу'))).toBe(true);
  });

  test('my-study — не начавший учёбу видит «Начать учёбу»', async () => {
    const { story } = makeStory({
      'get-student-by-user': {
        ...mockStudent,
        steps: [
          {
            stepId: 'cccc0000-0000-4000-8000-000000000001',
            status: 'issued',
            issuedAt: '2026-01-02T00:00',
          },
        ],
      },
    });

    const response = await story.handleCallback(
      'my-study',
      studentActor,
      session,
    );
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Начать учёбу'))).toBe(true);
    expect(btnTexts.some((t) => t.includes('Продолжить учёбу'))).toBe(false);
  });

  test('my-study:leave-confirm — confirm-диалог «Покинуть учёбу?» (FR-4)', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      'my-study:leave-confirm',
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Покинуть учёбу');
    expect(text).toContain('Прогресс сохранится');
    expect(text).toContain('ментор больше не будет тебя сопровождать');

    const btns = response.screen?.keyboard?.rows.flat() ?? [];
    const confirmBtn = btns.find((b) => b.text.includes('Да, покинуть'));
    expect(confirmBtn?.code).toBe('hub:my-study:leave');
    expect(btns.some((b) => b.text.includes('Остаться'))).toBe(true);
  });

  test('my-study:leave — вызывает dropStudent, реплика «Ты покинул учёбу…»', async () => {
    const { story, dispatch } = makeStory();

    const response = await story.handleCallback(
      'my-study:leave',
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const dropCalls = dispatch.mock.calls.filter(
      (c) => c[1].uc === 'dropStudent',
    );
    expect(dropCalls.length).toBe(1);
    expect(dropCalls[0]?.[1].input).toEqual({
      streamId: STREAM_ID,
      studentId: mockStudent.uuid,
    });

    const text = String(response.screen?.text);
    expect(text).toContain('Ты покинул учёбу');
    expect(text).toContain('возвращайся');
  });

  test('my-study:leave при ошибке — реплика-предупреждение с причиной отказа', async () => {
    const { story } = makeStory({
      'drop-student': refuse(
        'STUDENT_NOT_STUDYING',
        'conflict',
        undefined,
        'Нельзя снять студента с учёбы: он уже не учится.',
      ),
    });

    const response = await story.handleCallback(
      'my-study:leave',
      studentActor,
      session,
    );

    expect(response.screen).toBeUndefined();
    expect(String(response.notify?.text)).toContain('уже не учится');
    expect(response.notify?.kind).toBe('warn');
  });

  test('menuButtons — STUDENT видит «🎓 Моя учёба» (priority 20)', async () => {
    const { story } = makeStory();
    const items = await story.menuButtons(studentActor);
    const item = items.find((i) => i.text.includes('Моя учёба'));
    expect(item).toBeDefined();
    expect(item!.priority).toBe(20);
    if (item!.kind === 'callback') {
      expect(item!.action).toBe('hub:my-study');
    }
  });

  test('menuButtons — GUEST не видит кнопку', async () => {
    const { story } = makeStory();
    expect(await story.menuButtons(guestActor)).toEqual([]);
  });

  test('menuButtons — описание содержит «Моя учёба»', async () => {
    const { story } = makeStory();
    const item = (await story.menuButtons(studentActor)).find((i) =>
      i.text.includes('Моя учёба'),
    );
    expect(item?.description).toContain('Моя учёба');
  });
});

// ── Подписка на student.completed (кнопочные 7a/7b — канал invite, ФР-6) ──

describe('HubStory — подписка на StudentEvents.completed', () => {
  const moduleId = '33333333-3333-4333-8333-333333333333';
  const nextModuleId = '55555555-5555-4555-8555-555555555555';

  function makeCompletedEvent(outcome: 'advanced' | 'not_advanced') {
    return {
      eventId: 'ev-2',
      eventName: StudentEvents.completed.name,
      occurredAt: '2026-08-28T12:00:00.000Z',
      aggregateName: 'Student' as const,
      aggregateId: 'student-uuid',
      payload: {
        studentId: 'student-uuid',
        userId: 'user-1',
        streamId: '11111111-1111-1111-1111-111111111111',
        moduleId,
        outcome,
      },
    };
  }

  function makeStoryWithSender(place: unknown = undefined) {
    const mockAppApi = {
      execute: mock(async (name: string) => {
        if (name === 'get-user')
          return {
            uuid: 'user-1',
            name: 'Студент',
            telegramId: 123,
            roles: [Role.GUEST],
            createdAt: '2026-01-01T00:00:00.000Z',
          };
        return undefined;
      }),
      dispatch: dmgDispatch({ getModulePlace: () => place }, MODULES),
    };

    const sender = {
      notify: mock(async () => {}),
      invite: mock(async () => {}),
      kickFromGroup: mock(async () => {}),
    };

    const story = new HubStory();
    story.init(
      { appApi: mockAppApi, callers: testCallers } as never,
      sender as never,
    );
    return { story, sender };
  }

  function getSub(story: ReturnType<typeof makeStoryWithSender>['story']) {
    const sub = story
      .getEventSubscriptions()
      .find((s) => s.eventName === StudentEvents.completed.name);
    if (!sub) throw new Error('подписка на student.completed не найдена');
    return sub;
  }

  test('подписка идёт на FQN Def, а не на legacy-имя student.completed', () => {
    const { story } = makeStoryWithSender();
    const sub = getSub(story);
    expect(sub.eventName).toBe('stream.student.completed');
    const names = story.getEventSubscriptions().map((s) => s.eventName);
    expect(names).not.toContain('student.completed');
  });

  test('advanced + следующий модуль → invite с кнопкой «➡️ Следующий модуль»', async () => {
    const { story, sender } = makeStoryWithSender({
      courseId: 'c-1',
      isFirst: false,
      isLast: false,
      prevModuleId: 'm-0',
      nextModuleId,
    });

    await getSub(story).handle(makeCompletedEvent('advanced'));

    // 7a: кнопочный проактив — invite (исключение И3 до tasks-system)
    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [tgId, payload] = (sender.invite as ReturnType<typeof mock>).mock
      .calls[0] as [
      number,
      {
        text: string;
        keyboard: { rows: Array<Array<{ text: string; code: string }>> };
      },
    ];
    expect(tgId).toBe(123);
    expect(payload.text).toContain('Модуль заверш');
    expect(payload.text).toContain('записаться на следующий');
    const button = payload.keyboard.rows[0]?.[0];
    expect(button?.text).toBe('➡️ Следующий модуль');
    expect(button?.code).toBe(`course:course-catalog:wish:${nextModuleId}`);
  });

  test('not_advanced → invite с кнопкой «🔁 Пройти модуль снова»', async () => {
    const { story, sender } = makeStoryWithSender({
      courseId: 'c-1',
      isFirst: false,
      isLast: false,
      nextModuleId,
    });

    await getSub(story).handle(makeCompletedEvent('not_advanced'));

    // 7b: повтор того же модуля — кнопка ведёт на текущий moduleId
    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).toHaveBeenCalledTimes(1);
    const [, payload] = (sender.invite as ReturnType<typeof mock>).mock
      .calls[0] as [
      number,
      {
        text: string;
        keyboard: { rows: Array<Array<{ text: string; code: string }>> };
      },
    ];
    expect(payload.text).toContain('не пройден');
    expect(payload.text).toContain('снова');
    const button = payload.keyboard.rows[0]?.[0];
    expect(button?.text).toBe('🔁 Пройти модуль снова');
    expect(button?.code).toBe(`course:course-catalog:wish:${moduleId}`);
  });

  test('advanced + последний модуль → безкнопочный notify «Курс завершён» (7c), без invite', async () => {
    const { story, sender } = makeStoryWithSender({
      courseId: 'c-1',
      isFirst: false,
      isLast: true,
      prevModuleId: 'm-0',
    });

    await getSub(story).handle(makeCompletedEvent('advanced'));

    // Уведомление 7c шлёт стори (раньше — UC complete-student)
    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [tgId, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(tgId).toBe(123);
    expect(payload.kind).toBe('info');
    expect(String(payload.text)).toContain('Курс завершён');
  });

  test('нет telegramId → сообщения не отправляются', async () => {
    const { story, sender } = makeStoryWithSender({
      courseId: 'c-1',
      isLast: false,
      nextModuleId,
    });
    (
      story as unknown as { appApi: { execute: ReturnType<typeof mock> } }
    ).appApi.execute.mockImplementation(async (name: string) =>
      name === 'get-user'
        ? { uuid: 'user-1', telegramId: undefined }
        : undefined,
    );

    await getSub(story).handle(makeCompletedEvent('advanced'));

    expect(sender.notify).not.toHaveBeenCalled();
    expect(sender.invite).not.toHaveBeenCalled();
  });

  test('place undefined + advanced → безкнопочный notify «Модуль завершён» (7d), без invite', async () => {
    const { story, sender } = makeStoryWithSender(undefined);

    await getSub(story).handle(makeCompletedEvent('advanced'));

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(payload.kind).toBe('info');
    expect(String(payload.text)).toContain('Модуль завершён');
  });

  test('advanced, место модуля не определено (отказ UC) → notify «Модуль завершён» (7d)', async () => {
    const { story, sender } = makeStoryWithSender(moduleNotFound());

    await getSub(story).handle(makeCompletedEvent('advanced'));

    expect(sender.invite).not.toHaveBeenCalled();
    expect(sender.notify).toHaveBeenCalledTimes(1);
    const [, payload] = (sender.notify as ReturnType<typeof mock>).mock
      .calls[0] as [number, { text: unknown; kind: string }];
    expect(String(payload.text)).toContain('Модуль завершён');
  });
});
