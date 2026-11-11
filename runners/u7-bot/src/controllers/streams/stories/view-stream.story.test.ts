import { describe, expect, test } from 'bun:test';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import {
  ListScopeFactsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import {
  GetActiveStudentUcDef,
  GetStreamMembersUcDef,
  GetStreamUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { UserView } from '@u7-scl/domain/user/contract';
import { GetUserUcDef, UserModuleDef } from '@u7-scl/domain/user/contract';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { userActor } from '../../../core/user-actor.test-kit';
import { dmgDispatch, refuse } from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { streamView } from './stream-dmg.test-kit';
import {
  type LegacyStudent,
  progressProjection,
  streamMembers,
  studentView,
} from './student-dmg.test-kit';
import { ViewStreamStory } from './view-stream.story';

/** Модули, которые вызывает карточка потока: потоки, отзывы и курсы. */
const MODULES = [
  CourseModuleDef,
  StreamModuleDef,
  PeerReviewModuleDef,
  UserModuleDef,
];

const STREAM_ID = '11111111-1111-4111-8111-111111111111';

/** Поток в статусе enrollment с кодовым словом и без */
function makeStream(overrides: Record<string, unknown> = {}) {
  return streamView({
    contentSnapshot: [] as ContentSnapshot,
    ...overrides,
  });
}

function makeActor(roles: UserView['roles'] = ['GUEST']): U7BotActor {
  return userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaaaaa8',
    name: 'Гость',
    telegramId: 123,
    roles,
  });
}

describe('ViewStreamStory (S02-S04)', () => {
  const session: BotSession = {
    dialog: { path: 'stream/view-stream', seq: 2 },
  };
  const guest = makeActor();

  interface SetupOptions {
    /** Поток, возвращаемый getStream */
    stream?: Record<string, unknown>;
    /** Студенты: list-stream-students и состав потока (getStreamMembers) */
    students?: unknown[];
    /** Пользователи, возвращаемые get-user (по uuid) */
    users?: Record<string, { name: string }>;
    /** Зачисление отказывает: введено неверное кодовое слово */
    wrongKey?: boolean;
    /** Зачисление отказывает ошибкой валидации */
    enrollFails?: boolean;
    /** У пользователя уже есть живая запись студента */
    activeStudent?: boolean;
  }

  /** Факты отзывов скоупа (карточка потока): отзывов нет. */
  const listScopeFacts = () => ({ hasReviews: false, reviewsCount: 0 });

  function makeStory(opts: SetupOptions = {}) {
    const students = (opts.students ?? []) as LegacyStudent[];
    const stream = opts.stream ?? makeStream();
    const dispatch = dmgDispatch(
      {
        getStream: () => stream,
        getStreamMembers: () => streamMembers('m1-m1-m1', students),
        getStudentProgress: (input) => {
          const found = students.find(
            (s) => s.uuid === (input as { studentId: string }).studentId,
          );
          return found
            ? {
                student: studentView(found),
                progress: progressProjection(
                  (stream.contentSnapshot ?? []) as Parameters<
                    typeof progressProjection
                  >[0],
                  found,
                ),
              }
            : refuse('STUDENT_NOT_FOUND', 'not_found');
        },
        getActiveStudent: () =>
          opts.activeStudent
            ? {
                student: studentView(makeStudent() as unknown as LegacyStudent),
              }
            : {},
        enrollStudent: () => {
          if (opts.wrongKey)
            return refuse(
              'STUDENT_WRONG_ENROLLMENT_KEY',
              'validation',
              undefined,
              'Неверное кодовое слово',
            );
          if (opts.enrollFails)
            return refuse(
              'STUDENT_NO_STEPS',
              'conflict',
              undefined,
              'В потоке нет доступных шагов',
            );
          return { studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001' };
        },
        listScopeFacts,
        getStepsByLessons: () => ({}),
        getUser: (input) => {
          const { uuid } = input as { uuid: string };
          return (
            opts.users?.[uuid] ?? {
              uuid,
              name: 'Ментор Менторович',
              roles: ['GUEST'],
            }
          );
        },
      },
      MODULES,
    );

    const story = new ViewStreamStory();
    story.init({ appApi: { dispatch }, callers: testCallers } as never);
    return { story, dispatch };
  }

  // ── Карточка потока (view) ──

  test('view: показывает карточку потока', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text);
    expect(text).toContain('Поток «JS Core — Поток 2»');
    expect(text).toContain('Базовый поток по fullstack JS');
    expect(text).toContain('🟡 Набор открыт');
  });

  test('view: активный поток — без мёртвой кнопки «🔔 Уведомить о наборе»', async () => {
    const { story } = makeStory({ stream: makeStream({ status: 'active' }) });
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Уведомить'))).toBe(false);
  });

  test('view: показывает имя ментора', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    expect(String(response.screen?.text)).toContain('Ментор Менторович');
  });

  test('view: показывает количество студентов', async () => {
    const { story } = makeStory({
      students: [{ uuid: 'st1' }, { uuid: 'st2' }],
    });
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    expect(String(response.screen?.text)).toContain('Студентов: 2');
  });

  test('view: строчка «📚 Курс: Fullstack JS»', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    expect(String(response.screen?.text)).toContain('📚 Курс: Fullstack JS');
  });

  test('S02: публичные кнопки — Детали/Программа (рядом), Студенты, Назад к списку', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:program:${STREAM_ID}`);
    expect(codes).toContain(`view-stream:students:${STREAM_ID}`);
    expect(codes).toContain(`view-stream:details:${STREAM_ID}`);
    expect(codes).toContain('catalog:list');
  });

  test('view: гост на enrollment — кнопка «📝 Записаться»', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      guest,
      session,
    );
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Записаться'))).toBe(true);
  });

  test('MENTOR — владелец потока — НЕ видит lifecycle-кнопок', async () => {
    const mentor = makeActor(['MENTOR']);
    const { story } = makeStory({
      stream: makeStream({ mentorId: mentor.user.uuid, canManage: true }),
    });
    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      mentor,
      session,
    );
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Записаться'))).toBe(false);
    expect(btnTexts.some((t) => t.includes('Уведомить'))).toBe(false);
  });

  // ── Программа (program) ──

  test('program: показывает contentSnapshot', async () => {
    const snapshot: ContentSnapshot = [
      {
        projectId: 'proj-1',
        projectTitle: 'Проект «CLI-калькулятор»',
        lessons: [
          {
            lessonId: 'l1',
            lessonTitle: 'Урок «Введение»',
            stepIds: ['1', '2'],
          },
        ],
      },
    ];
    const { story } = makeStory({
      stream: makeStream({ contentSnapshot: snapshot }),
    });
    const response = await story.handleCallback(
      `program:${STREAM_ID}`,
      guest,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text);
    expect(text).toContain('Программа модуля');
    // дефис в доменном названии экранирован md-интерполяцией
    expect(text).toContain('CLI\\-калькулятор');
    expect(text).toContain('урок');
  });

  test('program: пустой contentSnapshot — заглушка', async () => {
    const { story } = makeStory({
      stream: makeStream({ contentSnapshot: [] }),
    });
    const response = await story.handleCallback(
      `program:${STREAM_ID}`,
      guest,
      session,
    );
    expect(String(response.screen?.text)).toContain('не загружена');
  });

  // ── Детали (details) ──

  test('details: показывает заполненные поля', async () => {
    const { story } = makeStory({
      stream: makeStream({ goal: 'Цель курса', result: 'Результат курса' }),
    });
    const response = await story.handleCallback(
      `details:${STREAM_ID}`,
      guest,
      session,
    );
    const text = String(response.screen?.text);
    expect(text).toContain('Детали');
    expect(text).toContain('Цель курса');
    expect(text).toContain('Результат курса');
  });

  test('details: без полей — заглушка', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `details:${STREAM_ID}`,
      guest,
      session,
    );
    expect(String(response.screen?.text)).toContain('не добавлена');
  });

  test('details: кнопка «Назад к потоку»', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `details:${STREAM_ID}`,
      guest,
      session,
    );
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:view:${STREAM_ID}`);
  });

  test('view без streamId — ошибка', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback('view', guest, session);
    expect(String(response.screen?.text)).toContain('Неизвестная');
  });

  // ── Список студентов (students) ──

  /** Полная запись студента (как возвращает get-student-progress) */
  function makeStudent(overrides: Record<string, unknown> = {}) {
    return {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      enrolledAt: '2026-01-01T00:00',
      status: 'active',
      streamId: STREAM_ID,
      currentStepId: 'cccc0000-0000-4000-8000-000000000001',
      steps: [],
      createdAt: '2026-01-01T00:00',
      ...overrides,
    };
  }

  test('students: пустой список — заголовок и «Назад к потоку»', async () => {
    const { story } = makeStory({ students: [] });
    const response = await story.handleCallback(
      `students:${STREAM_ID}`,
      guest,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('Студенты потока');
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:view:${STREAM_ID}`);
  });

  test('students: НЕ содержит менторских кнопок (⛔✅🔄)', async () => {
    const { story } = makeStory({ students: [makeStudent()] });
    const response = await story.handleCallback(
      `students:${STREAM_ID}`,
      guest,
      session,
    );
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => /[⛔✅🔄]/u.test(t))).toBe(false);
  });

  // ── Карточка студента (student-detail) ──

  test('student-detail: показывает карточку студента', async () => {
    const { story } = makeStory({
      students: [makeStudent() as unknown as LegacyStudent],
      users: {
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': { name: 'Студент Студентов' },
      },
    });

    const response = await story.handleCallback(
      'student-detail:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
      guest,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text);
    expect(text).toContain('Студент Студентов');
    expect(text).toContain('учится');
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:students:${STREAM_ID}`);
  });

  // ── Запись (enroll): без кодового слова → delegate на меню ──

  test('enroll без кодового слова: поздравление-реплика + delegate на меню', async () => {
    const { story, dispatch } = makeStory({
      stream: makeStream({ requiresEnrollmentKey: false }),
    });
    const response = await story.handleCallback(
      `enroll:${STREAM_ID}`,
      guest,
      session,
    );

    const enrollCall = dispatch.mock.calls.find(
      (c) => c[1].uc === 'enrollStudent',
    );
    expect(enrollCall?.[1].input).toEqual({
      streamId: STREAM_ID,
      enrollmentKey: undefined,
    });
    expect(String(response.notify?.text)).toContain('успешно записаны');
    // delegate: enroll→menu (сохранённое использование)
    expect(response.delegate?.path).toBe('app:main-menu');
    expect(response.screen).toBeUndefined();
  });

  test('enroll c кодовым словом: экран запроса слова + awaitInput', async () => {
    const { story, dispatch } = makeStory({
      stream: makeStream({ requiresEnrollmentKey: true }),
    });
    const response = await story.handleCallback(
      `enroll:${STREAM_ID}`,
      guest,
      session,
    );

    expect(String(response.screen?.text)).toContain('кодовое слово');
    // Зачисления ещё нет — только запрос слова
    const enrollCalls = dispatch.mock.calls.filter(
      (c) => c[1].uc === 'enrollStudent',
    );
    expect(enrollCalls).toHaveLength(0);
    expect(response.awaitInput?.context).toEqual({
      streamId: STREAM_ID,
      attempts: 0,
    });
    // Кнопка отмены — на enroll-cancel
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:cancel:${STREAM_ID}`);
  });

  test('enroll: ошибка UC — ucErrorNotify (реплика warn без захвата экрана)', async () => {
    const { story } = makeStory({ enrollFails: true });

    const response = await story.handleCallback(
      `enroll:${STREAM_ID}`,
      guest,
      session,
    );
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('нет доступных шагов');
    expect(response.delegate).toBeUndefined();
  });

  // ── Отмена записи (cancel): release + delegate на view ──

  test('cancel: release + delegate на экран потока (enroll-cancel→view)', async () => {
    const { story } = makeStory();
    const response = await story.handleCallback(
      `cancel:${STREAM_ID}`,
      guest,
      session,
    );
    expect(response.release).toBe(true);
    expect(response.delegate?.path).toBe(`view-stream:view:${STREAM_ID}`);
  });

  // ── Ввод кодового слова (handleMessage) ──

  function enrollSession(attempts: number): BotSession {
    return {
      dialog: {
        path: 'stream/view-stream',
        seq: 2,
        input: {
          context: { streamId: STREAM_ID, attempts },
        },
      },
    };
  }

  test('handleMessage: верное слово — зачисление (notify + delegate на меню)', async () => {
    const { story, dispatch } = makeStory({
      stream: makeStream({ requiresEnrollmentKey: true }),
    });
    const response = await story.handleMessage(
      { type: 'message', text: 'дракон', telegramId: 1 },
      guest,
      enrollSession(0),
    );

    const enrollCall = dispatch.mock.calls.find(
      (c) => c[1].uc === 'enrollStudent',
    );
    expect(enrollCall?.[1].input).toEqual({
      streamId: STREAM_ID,
      enrollmentKey: 'дракон',
    });
    expect(String(response.notify?.text)).toContain('успешно записаны');
    expect(response.delegate?.path).toBe('app:main-menu');
  });

  test('handleMessage: неверное слово — warn-переспрос + awaitInput с попытками+1', async () => {
    const { story } = makeStory({ wrongKey: true });
    const response = await story.handleMessage(
      { type: 'message', text: 'не то', telegramId: 1 },
      guest,
      enrollSession(0),
    );

    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Осталось попыток: 2');
    expect(response.awaitInput?.context).toEqual({
      streamId: STREAM_ID,
      attempts: 1,
    });
    expect(response.screen).toBeUndefined();
  });

  test('handleMessage: попытки исчерпаны — release + экран возврата к потоку', async () => {
    const { story } = makeStory({ wrongKey: true });
    const response = await story.handleMessage(
      { type: 'message', text: 'не то', telegramId: 1 },
      guest,
      enrollSession(2),
    );

    expect(response.release).toBe(true);
    expect(String(response.screen?.text)).toContain('Попытки исчерпаны');
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(`view-stream:view:${STREAM_ID}`);
  });

  // ── Мосты навигации ──

  test('students: кнопка студента ведёт в view-stream:student-detail (не monitor)', async () => {
    const { story } = makeStory({
      students: [
        makeStudent({
          uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0009',
          userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9',
        }),
      ],
    });
    const response = await story.handleCallback(
      `students:${STREAM_ID}`,
      guest,
      session,
    );
    const codes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];
    expect(codes).toContain(
      'view-stream:student-detail:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0009',
    );
    expect(codes.some((c) => c.startsWith('monitor:'))).toBe(false);
  });
});

// ── Публичная drill-down программа модуля (S03) ──

describe('ViewStreamStory — публичная drill-down программа модуля (S03)', () => {
  const STREAM_ID_PUB = '22222222-2222-4222-8222-222222222222';

  const pubSession: BotSession = {
    dialog: { path: 'stream/view-stream', seq: 1 },
  };
  const pubActor = makeActor();

  const snapshot: ContentSnapshot = [
    {
      projectId: 'proj-1',
      projectTitle: 'Введение в архитектуру',
      lessons: [
        {
          lessonId: 'lesson-1',
          lessonTitle: 'Модули и компоненты',
          stepIds: ['step-1', 'step-2'],
        },
        {
          lessonId: 'lesson-2',
          lessonTitle: 'Интерфейсы',
          stepIds: ['step-3'],
        },
      ],
    },
    {
      projectId: 'proj-2',
      projectTitle: 'Паттерны проектирования',
      lessons: [
        {
          lessonId: 'lesson-3',
          lessonTitle: 'Фасад и адаптер',
          stepIds: ['step-4'],
        },
      ],
    },
  ];

  function makePublicStory() {
    const story = new ViewStreamStory();
    story.init({
      appApi: {
        dispatch: dmgDispatch(
          {
            getStream: () =>
              makeStream({ uuid: STREAM_ID_PUB, contentSnapshot: snapshot }),
            getStepsByLessons: () => ({
              'lesson-1': [
                { uuid: 'step-1', description: 'Шаг 1: Описание первого шага' },
                { uuid: 'step-2', description: 'Шаг 2: Описание второго шага' },
              ],
            }),
            getStep: (input) => ({
              uuid: (input as { stepId: string }).stepId,
              description: 'Шаг 1',
              kind: 'text',
              content: 'Секретное тело шага',
            }),
          },
          MODULES,
        ),
      },
      callers: testCallers,
    } as never);
    return { story };
  }

  test('root: карточка модуля — список проектов без статусов и кнопка назад', async () => {
    const { story } = makePublicStory();
    const response = await story.handleCallback(
      `program:${STREAM_ID_PUB}`,
      pubActor,
      pubSession,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text);
    expect(text).toContain('Программа модуля');
    expect(text).toContain('Введение в архитектуру');
    expect(text).toContain('Паттерны проектирования');
    // Без статусов
    expect(text).not.toContain('✅');
    expect(text).not.toContain('🔒');

    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    const btnCodes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];

    expect(btnTexts).toContain('1. Введение в архитектуру');
    expect(btnTexts).toContain('2. Паттерны проектирования');
    expect(btnCodes).toContain(
      `view-stream:prog:${STREAM_ID_PUB}:project:proj-1`,
    );
    expect(btnCodes).toContain(
      `view-stream:prog:${STREAM_ID_PUB}:project:proj-2`,
    );
    expect(btnTexts).toContain('⬅️ Назад к потоку');
    expect(btnCodes).toContain(`view-stream:view:${STREAM_ID_PUB}`);
  });

  test('project: карточка проекта — коды кнопок уроков (мосты в nav-tree)', async () => {
    const { story } = makePublicStory();
    const response = await story.handleCallback(
      `prog:${STREAM_ID_PUB}:project:proj-1`,
      pubActor,
      pubSession,
    );
    assertDialogResponseMarkdownSafe(response);

    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    const btnCodes =
      response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];

    expect(btnTexts).toContain('1. Модули и компоненты');
    expect(btnTexts).toContain('2. Интерфейсы');
    expect(btnCodes).toContain(
      `view-stream:prog:${STREAM_ID_PUB}:lesson:lesson-1`,
    );
    expect(btnCodes).toContain(
      `view-stream:prog:${STREAM_ID_PUB}:lesson:lesson-2`,
    );
  });

  test('step: зритель получает отказ доступа к телу шага', async () => {
    const { story } = makePublicStory();
    const response = await story.handleCallback(
      `prog:${STREAM_ID_PUB}:step:step-1`,
      pubActor,
      pubSession,
    );
    const text = String(response.screen?.text);
    expect(text).toContain('Тела шагов недоступны');
  });
});

describe('ViewStreamStory — кнопка «💬 Отзывы» в карточке потока (S02)', () => {
  const rvSession: BotSession = {
    dialog: { path: 'stream/view-stream', seq: 1 },
  };
  const rvActor = makeActor();

  /** Мок карточки: единственная переменная — факты отзывов скоупа. */
  function makeStoryWithFacts(
    facts:
      | { hasReviews: boolean; reviewsCount: number }
      | 'fail'
      | 'throw'
      | undefined,
  ) {
    // Отказ или исключение касается только фактов отзывов; поток читается всегда
    const streamAnswers = {
      getStream: () => makeStream(),
      getStreamMembers: () => ({ mentorId: 'm1-m1-m1', students: [] }),
      getActiveStudent: () => ({}),
    };
    const dispatch =
      facts === 'throw' || facts === 'fail'
        ? dmgDispatch(
            {
              ...streamAnswers,
              listScopeFacts: () => {
                if (facts === 'throw') throw new Error('диспетчер недоступен');
                return refuse('REVIEW_UNAVAILABLE', 'internal');
              },
            },
            MODULES,
          )
        : dmgDispatch(
            {
              ...streamAnswers,
              listScopeFacts: () =>
                facts ?? { hasReviews: false, reviewsCount: 0 },
            },
            MODULES,
          );
    const mockAppApi = { dispatch };
    const story = new ViewStreamStory();
    story.init({ appApi: mockAppApi, callers: testCallers } as never);
    return { story, mockAppApi };
  }

  test('есть отзывы → кнопка «💬 Отзывы» с мостом в S07 peer-review', async () => {
    const { story } = makeStoryWithFacts({
      hasReviews: true,
      reviewsCount: 3,
    });

    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      rvActor,
      rvSession,
    );
    assertDialogResponseMarkdownSafe(response);

    const btn = response.screen?.keyboard?.rows
      .flat()
      .find((b) => b.text === '💬 Отзывы');
    expect(btn?.code).toBe(`peer-review:scope-reviews:view:${STREAM_ID}`);
  });

  test('нет отзывов → кнопки нет', async () => {
    const { story } = makeStoryWithFacts({
      hasReviews: false,
      reviewsCount: 0,
    });

    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      rvActor,
      rvSession,
    );

    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Отзывы'))).toBe(false);
  });

  test('факты недоступны (отказ UC, не ok) → карточка живёт, кнопки нет', async () => {
    const { story } = makeStoryWithFacts('fail');

    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      rvActor,
      rvSession,
    );

    expect(String(response.screen?.text)).toContain('JS Core');
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Отзывы'))).toBe(false);
  });

  test('исключение диспетчера → карточка живёт, кнопки нет (как v0.2.6)', async () => {
    const { story } = makeStoryWithFacts('throw');

    const response = await story.handleCallback(
      `view:${STREAM_ID}`,
      rvActor,
      rvSession,
    );

    expect(String(response.screen?.text)).toContain('JS Core');
    const btnTexts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(btnTexts.some((t) => t.includes('Отзывы'))).toBe(false);
  });

  test('видимость проверяется UC listScopeFacts с scopeId потока', async () => {
    const { story, mockAppApi } = makeStoryWithFacts({
      hasReviews: true,
      reviewsCount: 1,
    });

    await story.handleCallback(`view:${STREAM_ID}`, rvActor, rvSession);

    expect(
      mockAppApi.dispatch.mock.calls.map(([, command]) => command),
    ).toEqual([
      GetStreamUcDef.command({ streamId: STREAM_ID }),
      GetStreamMembersUcDef.command({ streamId: STREAM_ID }),
      ListScopeFactsUcDef.command({ scopeId: STREAM_ID }),
      GetUserUcDef.command({ uuid: 'm1-m1-m1' }),
      GetActiveStudentUcDef.command({ userId: rvActor.user.uuid }),
    ]);
  });
});
