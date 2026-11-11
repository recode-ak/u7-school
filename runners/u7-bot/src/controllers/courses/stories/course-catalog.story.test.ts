import { describe, expect, test } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import {
  type ContentSnapshot,
  type CourseView,
  GetCourseByModuleUcDef,
  GetCourseUcDef,
  GetModuleSnapshotUcDef,
  GetModuleUcDef,
  GetStepsByLessonsUcDef,
  ListCoursesUcDef,
  type ModuleView,
} from '@u7-scl/domain/course/contract';
import {
  CancelWishUcDef,
  CreateCourseWishUcDef,
  CreateModuleWishUcDef,
  ListUserWishesUcDef,
  WishErrors,
} from '@u7-scl/domain/wish/contract';
import { Role } from '@u7-scl/user/domain';
import {
  type Command,
  type DomainError,
  type Err,
  ok,
  type Result,
  UserCaller,
} from 'dmg-core';
import { Routes } from '../../shared/routes';
import { CourseCatalogStory } from './course-catalog.story';
import {
  courseNotFound,
  courseView,
  dmgDispatch,
  moduleNotFound,
  moduleView,
  refuse,
  stage,
  type UcAnswers,
} from './course-dmg.test-kit';

/** Актор UC DMG — субъект `UserCaller`, переданный в `appApi.dispatch`. */
function subjectOf(caller: unknown): User {
  if (!(caller instanceof UserCaller)) {
    throw new Error('UC DMG вызван без UserCaller');
  }
  return caller.user as User;
}

/** Ответ UC в моке: успех — значением, отказ домена (`Err`) — отказом kit. */
function answerOf(result: Result<unknown, DomainError>) {
  if (result.ok) return result.value;
  const { code, kind, label, payload } = result.error;
  return refuse(code, kind, payload, label);
}

/** Вызов UC `uc` в моке `dispatch`: вход команды и субъект. */
function ucCall(dispatch: ReturnType<typeof dmgDispatch>, uc: string) {
  const call = dispatch.mock.calls.find(
    ([, command]: [unknown, Command, unknown]) => command.uc === uc,
  );
  if (call === undefined) throw new Error(`Команда ${uc} не отправлена`);
  return { input: call[1].input, subject: subjectOf(call[2]) };
}

describe('CourseCatalogStory', () => {
  const session: BotSession = {
    dialog: { path: 'course/course-catalog', seq: 1 },
  };
  const actor: User = {
    uuid: 'user-1',
    name: 'Гость',
    telegramId: 123,
    roles: [Role.GUEST],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  /**
   * Мок `appApi.dispatch` над данными курсов: ответы модуля `course`
   * (`getModule` без модуля — отказ, `getModuleSnapshot` без снимка — пустой)
   * и список желаний пользователя. `overrides` заменяют ответы по имени UC.
   */
  function makeAppApi(
    courses: CourseView[],
    modules: Record<string, ModuleView> = {},
    snapshots: Record<string, ContentSnapshot> = {},
    steps: Record<string, Array<{ uuid: string; description: string }>> = {},
    wishes: Array<{
      userId: string;
      target:
        | { kind: 'course'; courseId: string }
        | { kind: 'module'; moduleId: string };
      status: string;
    }> = [],
    overrides: UcAnswers = {},
  ) {
    return dmgDispatch({
      [ListCoursesUcDef.name]: () => courses,
      [GetCourseUcDef.name]: (input) => {
        const { courseId } = input as { courseId: string };
        return (
          courses.find((c) => c.uuid === courseId) ?? courseNotFound(courseId)
        );
      },
      [GetCourseByModuleUcDef.name]: (input) => {
        const { moduleId } = input as { moduleId: string };
        return courses.find((c) => c.moduleIds.includes(moduleId));
      },
      [GetModuleUcDef.name]: (input) => {
        const { moduleId } = input as { moduleId: string };
        return modules[moduleId] ?? moduleNotFound(moduleId);
      },
      [GetModuleSnapshotUcDef.name]: (input) => {
        const { moduleId } = input as { moduleId: string };
        return snapshots[moduleId] ?? [];
      },
      [GetStepsByLessonsUcDef.name]: (input) => {
        const { lessonIds } = input as { lessonIds: string[] };
        return Object.fromEntries(
          lessonIds.filter((id) => steps[id]).map((id) => [id, steps[id]]),
        );
      },
      [ListUserWishesUcDef.name]: (_input, caller) =>
        wishes.filter((w) => w.userId === subjectOf(caller).uuid),
      ...overrides,
    });
  }

  /** Story над моком `dispatch`; субъект — резолвер `callers` приложения. */
  function initStory(
    story: CourseCatalogStory,
    dispatch: ReturnType<typeof dmgDispatch>,
  ) {
    // Резолвер `Caller` приложения (D-50): актор бота зарегистрирован.
    const callers = {
      resolve: async (uuid: string | undefined) => {
        expect(uuid).toBe(actor.uuid);
        return new UserCaller(actor);
      },
    };
    story.init({ appApi: { dispatch }, callers } as never);
  }

  // ── Главное меню (декларативные menuButtons) ──

  test('menuButtons возвращает кнопку главного меню (приоритет 12, «📖 Курсы»)', async () => {
    const story = new CourseCatalogStory();
    const items = await story.menuButtons(actor);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item?.kind).toBe('callback');
    expect(item?.text).toBe('📖 Курсы');
    expect(item?.priority).toBe(12);
    if (item?.kind === 'callback') {
      expect(item.action).toBe('course-catalog:list');
    }
  });

  // ── Уровень 0: Курсы + этапы inline ──

  test('list: показывает курсы с этапами inline, без описаний', async () => {
    const appApi = makeAppApi([
      courseView({
        uuid: 'c1',
        title: 'JS Basics',
        description: 'Описание курса — не должно быть видно',
        stages: [stage('Синтаксис', ['m1', 'm2']), stage('Практика', ['m3'])],
      }),
    ]);

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback('list', actor, session);
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Курсы');
    expect(text).toContain('JS Basics');
    expect(text).toContain('Синтаксис');
    expect(text).toContain('Практика');
    expect(text).toContain('модул');
    // Описание НЕ показывается
    expect(text).not.toContain('Описание курса');

    // Кнопка этапа ведёт на phase:
    const rows = response.screen?.keyboard?.rows ?? [];
    const phaseBtn = rows.find((r) => r[0]?.text?.includes('Синтаксис'));
    expect(phaseBtn).toBeDefined();
    expect(phaseBtn![0]!.code).toBe('course-catalog:phase:c1:0');

    // Кнопка «Главное меню»
    const lastRow = rows[rows.length - 1]!;
    expect(lastRow[0]!.text).toBe('↩️ Главное меню');
  });

  test('list: пустой список', async () => {
    const appApi = makeAppApi([]);
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback('list', actor, session);
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain(
      'Пока нет доступных курсов',
    );
  });

  test('list: отказ listCourses — реплика ucErrorNotify, а не «нет курсов»', async () => {
    const appApi = makeAppApi([], {}, {}, {}, [], {
      [ListCoursesUcDef.name]: () => refuse('SERVER_INTERNAL', 'internal'),
    });
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback('list', actor, session);
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Произошла ошибка');
    expect(response.screen).toBeUndefined();
  });

  // ── Уровень 1: Этап + модули подуровнем ──

  test('phase: модули жирным, проекты подуровнем', async () => {
    const courseUuid = 'c2';
    const appApi = makeAppApi(
      [
        courseView({
          uuid: courseUuid,
          title: 'Fullstack JS',
          description: '...',
          stages: [stage('Синтаксис', ['m-1']), stage('Алгоритмика', ['m-2'])],
        }),
      ],
      {
        'm-1': moduleView({
          uuid: 'm-1',
          title: 'Переменные',
          description: '...',
          projects: [
            {
              uuid: 'p1',
              title: 'Введение',
              lessonIds: ['l1', 'l2'],
              status: 'published',
            },
          ],
        }),
        'm-2': moduleView({
          uuid: 'm-2',
          title: 'Алгоритмы',
          description: '...',
          projects: [
            {
              uuid: 'p2',
              title: 'Сортировка',
              lessonIds: ['l3'],
              status: 'published',
            },
          ],
        }),
      },
    );

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      `phase:${courseUuid}:0`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Курс 1/1: Fullstack JS');
    expect(text).toContain('Этап 1/2: Синтаксис');
    expect(text).toContain('Переменные');

    // Кнопки-модули
    const rows = response.screen?.keyboard?.rows ?? [];
    const modBtn = rows.find((r) => r[0]?.text?.includes('Переменные'));
    expect(modBtn).toBeDefined();
    expect(modBtn![0]!.code).toBe(`course-catalog:module:${courseUuid}:0:m-1`);

    // Кнопка «Назад к курсу»
    expect(rows.some((r) => r[0]?.text?.includes('Назад к курсу'))).toBe(true);
  });

  // ── Уровень 2: Модуль + проекты подуровнем ──

  test('module: проекты жирным, уроки подуровнем', async () => {
    const courseUuid = 'c3';
    const appApi = makeAppApi(
      [
        courseView({
          uuid: courseUuid,
          title: 'Course',
          description: '...',
          stages: [stage('Синтаксис', ['m-a'])],
        }),
      ],
      {
        'm-a': moduleView({
          uuid: 'm-a',
          title: 'Модуль A',
          description: '...',
          projects: [],
        }),
      },
      {
        'm-a': [
          {
            projectId: 'pa',
            projectTitle: 'Проект 1',
            lessons: [
              { lessonId: 'l1', lessonTitle: 'Урок 1', stepIds: ['s1'] },
            ],
          },
        ],
      },
    );

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      `module:${courseUuid}:0:m-a`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Этап 1/1: Синтаксис');
    expect(text).toContain('Модуль 1/1: Модуль A');
    expect(text).toContain('Проект 1');

    // Кнопки-проекты
    const rows = response.screen?.keyboard?.rows ?? [];
    const projBtn = rows.find((r) => r[0]?.text?.includes('Проект 1'));
    expect(projBtn).toBeDefined();
    expect(projBtn![0]!.code).toBe(`course-catalog:prj:${courseUuid}:m-a:pa`);

    // Курс из одного этапа: уровня этапа в навигации нет — «Назад к курсу»
    expect(rows.some((r) => r[0]?.text?.includes('Назад к курсу'))).toBe(true);
    expect(rows.some((r) => r[0]?.text?.includes('Назад к этапу'))).toBe(false);
  });

  // ── Уровень 3: Проект + уроки с шагами-заголовками подуровнем ──

  test('project: уроки жирным, шаги-заголовки подуровнем', async () => {
    const courseUuid = 'c4';
    const appApi = makeAppApi(
      [
        courseView({
          uuid: courseUuid,
          title: 'Course',
          description: '...',
          stages: [stage('Основы', ['m-x'])],
        }),
      ],
      {
        'm-x': moduleView({
          uuid: 'm-x',
          title: 'Модуль X',
          description: '...',
          projects: [],
        }),
      },
      {
        'm-x': [
          {
            projectId: 'proj-1',
            projectTitle: 'ToDo App',
            lessons: [
              {
                lessonId: 'les-a',
                lessonTitle: 'HTML разметка',
                stepIds: ['s1'],
              },
              {
                lessonId: 'les-b',
                lessonTitle: 'CSS стили',
                stepIds: ['s2'],
              },
            ],
          },
        ],
      },
      {
        'les-a': [{ uuid: 's1', description: 'Структура DOM' }],
        'les-b': [{ uuid: 's2', description: 'Селекторы' }],
      },
    );

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      `project:${courseUuid}:0:m-x:proj-1`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Модуль 1/1: Модуль X');
    expect(text).toContain('Проект 1/1: ToDo App');
    expect(text).toContain('HTML разметка');
    expect(text).toContain('CSS стили');

    // Кнопки-уроки
    const rows = response.screen?.keyboard?.rows ?? [];
    const lessonBtn = rows.find((r) => r[0]?.text?.includes('HTML разметка'));
    expect(lessonBtn).toBeDefined();
    expect(lessonBtn![0]!.code).toBe(
      `course-catalog:les:${courseUuid}:proj-1:les-a`,
    );

    // Кнопка «Назад к модулю»
    expect(rows.some((r) => r[0]?.text?.includes('Назад к модулю'))).toBe(true);
  });

  // ── Уровень 4: Урок (шаги только заголовками, закрытый уровень) ──

  test('lesson: шаги только заголовками, входа в шаг нет', async () => {
    const courseUuid = 'c5';
    const appApi = makeAppApi(
      [
        courseView({
          uuid: courseUuid,
          title: 'Course',
          description: '...',
          stages: [stage('Phase', ['m-z'])],
        }),
      ],
      {
        'm-z': moduleView({
          uuid: 'm-z',
          title: 'Модуль Z',
          description: '...',
          projects: [],
        }),
      },
      {
        'm-z': [
          {
            projectId: 'proj-1',
            projectTitle: 'App',
            lessons: [
              {
                lessonId: 'les-x',
                lessonTitle: 'Урок 1',
                stepIds: ['step-1', 'step-2'],
              },
            ],
          },
        ],
      },
      {
        'les-x': [
          { uuid: 'step-1', description: 'Что такое переменные' },
          { uuid: 'step-2', description: 'Типы данных' },
        ],
      },
    );

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      `lesson:${courseUuid}:0:m-z:proj-1:les-x`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Проект 1/1: App');
    expect(text).toContain('Урок 1/1: Урок 1');
    expect(text).toContain('Что такое переменные');
    expect(text).toContain('Типы данных');

    // Кнопок шагов на клавиатуре НЕТ
    const rows = response.screen?.keyboard?.rows ?? [];
    const flatBtns = rows.flat();
    expect(flatBtns.some((b) => b.text.includes('Что такое переменные'))).toBe(
      false,
    );
    expect(flatBtns.some((b) => b.text.includes('Типы данных'))).toBe(false);

    // Кнопка «Назад к проекту»
    expect(flatBtns.some((b) => b.text.includes('Назад к проекту'))).toBe(true);
  });

  test('list: курс из одного этапа сразу показывает модули этапа', async () => {
    const appApi = makeAppApi(
      [
        courseView({
          uuid: 'c-one',
          title: 'Один этап',
          stages: [stage('Единственный', ['m-1'])],
        }),
      ],
      {
        'm-1': moduleView({
          uuid: 'm-1',
          title: 'Переменные',
          projects: [
            {
              uuid: 'p1',
              title: 'Введение',
              lessonIds: ['l1'],
              status: 'published',
            },
          ],
        }),
      },
    );
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback('list', actor, session);
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Этап 1/1: Единственный');
    expect(text).toContain('*Модули этапа:*');
    const rows = response.screen?.keyboard?.rows ?? [];
    const modBtn = rows.find((r) => r[0]?.text?.includes('Переменные'));
    expect(modBtn![0]!.code).toBe('course-catalog:module:c-one:0:m-1');
    // кнопки этапа в списке нет
    expect(
      rows.some((r) => r[0]?.code === 'course-catalog:phase:c-one:0'),
    ).toBe(false);
  });

  describe('курс без этапов', () => {
    const noStages = courseView({
      uuid: 'c-flat',
      title: 'Без этапов',
      moduleIds: ['m-1', 'm-2'],
      stages: [],
    });
    const modules = {
      'm-1': moduleView({ uuid: 'm-1', title: 'Первый модуль' }),
      'm-2': moduleView({ uuid: 'm-2', title: 'Второй модуль' }),
    };
    const snapshots = {
      'm-1': [
        {
          projectId: 'pa',
          projectTitle: 'Проект A',
          lessons: [{ lessonId: 'la', lessonTitle: 'Урок A', stepIds: [] }],
        },
      ],
    };

    test('project — курс найден по модулю, «Назад к модулю» с :0:', async () => {
      const appApi = makeAppApi([noStages], modules, snapshots);
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        'prj:c-flat:m-1:pa',
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('Проект 1/1: Проект A');
      expect(text).not.toContain('Этап');
      const flat = (response.screen?.keyboard?.rows ?? []).flat();
      expect(flat.find((b) => b.text.includes('Назад к модулю'))?.code).toBe(
        'course-catalog:module:c-flat:0:m-1',
      );
    });

    test('lesson без модуля в адресе — модуль ищется по программе курса', async () => {
      const appApi = makeAppApi([noStages], modules, snapshots);
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        'les:c-flat:pa:la',
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('Модуль 1/2: Первый модуль');
      expect(text).toContain('Урок 1/1: Урок A');
      expect(text).not.toContain('Этап');
    });

    test('phase — «Этап не найден или недоступен»', async () => {
      const appApi = makeAppApi([noStages], modules, snapshots);
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        'phase:c-flat:0',
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(String(response.screen?.text)).toContain(
        'Этап не найден или недоступен',
      );
    });
  });

  // ── Загрузка курса и отказы UC ──

  test('курс вне listCourses подгружается через getCourse', async () => {
    const hidden = courseView({
      uuid: 'c-hidden',
      title: 'Скрытый курс',
      stages: [stage('Первый', []), stage('Второй', [])],
    });
    const appApi = makeAppApi([hidden], {}, {}, {}, [], {
      [ListCoursesUcDef.name]: () => [],
    });
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      'course:c-hidden',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Скрытый курс');
    expect(ucCall(appApi, GetCourseUcDef.name).input).toEqual({
      courseId: 'c-hidden',
    });
  });

  test('отказ getModule — заголовок модуля «Модуль <8 символов uuid>»', async () => {
    const moduleId = 'abcdef12-0000-4000-8000-000000000000';
    const appApi = makeAppApi(
      [
        courseView({
          uuid: 'c-two',
          title: 'Курс',
          stages: [stage('Первый', [moduleId]), stage('Второй', [])],
        }),
      ],
      {},
      { [moduleId]: [] },
    );
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      `module:c-two:0:${moduleId}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Модуль abcdef12');
  });

  test('отказ getStepsByLessons — шаги урока без описаний: «Шаг n»', async () => {
    const appApi = makeAppApi(
      [
        courseView({
          uuid: 'c-two',
          title: 'Курс',
          stages: [stage('Первый', ['m-1']), stage('Второй', [])],
        }),
      ],
      { 'm-1': moduleView({ uuid: 'm-1', title: 'Модуль' }) },
      {
        'm-1': [
          {
            projectId: 'pa',
            projectTitle: 'Проект',
            lessons: [{ lessonId: 'la', lessonTitle: 'Урок', stepIds: ['s1'] }],
          },
        ],
      },
      {},
      [],
      {
        [GetStepsByLessonsUcDef.name]: () =>
          refuse('SERVER_INTERNAL', 'internal'),
      },
    );
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      'lesson:c-two:0:m-1:pa:la',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Шаг 1');
  });

  // ── Ошибки ──

  test('phases: несуществующий курс — ошибка', async () => {
    const appApi = makeAppApi([]);
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      'phases:bad-uuid',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('не найден');
  });

  test('modules: несуществующий курс — ошибка', async () => {
    const appApi = makeAppApi([]);
    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      'modules:bad:0',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('не найден');
  });

  test('projects: отказ getModuleSnapshot — «Модуль не найден или недоступен»', async () => {
    const appApi = makeAppApi(
      [courseView({ uuid: 'c1', title: 'C', stages: [stage('P', ['bad'])] })],
      {},
      {},
      {},
      [],
      { [GetModuleSnapshotUcDef.name]: () => moduleNotFound('bad') },
    );

    const story = new CourseCatalogStory();
    initStory(story, appApi);

    const response = await story.handleCallback(
      'projects:c1:0:bad',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain(
      'Модуль не найден или недоступен',
    );
  });

  // ── Запись на модуль (кнопка из уведомления о завершении) ──

  describe('wish — запись на модуль', () => {
    const moduleId = '33333333-3333-4333-8333-333333333333';

    function makeWishApi(error?: Err<DomainError>) {
      return dmgDispatch({
        [CreateModuleWishUcDef.name]: () => answerOf(error ?? ok(undefined)),
      });
    }

    test('успех: вызывает create-module-wish и подтверждает', async () => {
      const api = makeWishApi();
      const story = new CourseCatalogStory();
      initStory(story, api);

      const response = await story.handleCallback(
        `wish:${moduleId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(ucCall(api, CreateModuleWishUcDef.name)).toEqual({
        input: { moduleId },
        subject: actor,
      });

      expect(String(response.screen?.text)).toContain('Записали');
    });

    test('желание уже есть: дружелюбное сообщение, не ошибка', async () => {
      const error = WishErrors.ALREADY_EXISTS.err({
        userId: actor.uuid,
        moduleId,
        status: 'expressed',
      });
      const api = makeWishApi(error);
      const story = new CourseCatalogStory();
      initStory(story, api);

      const response = await story.handleCallback(
        `wish:${moduleId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(String(response.screen?.text)).toContain('уже');
      expect(String(response.screen?.text)).not.toContain('⚠️');
    });

    test('другая ошибка: errorNotify — warn-реплика без захвата экрана', async () => {
      const api = makeWishApi(WishErrors.MODULE_NOT_FOUND.err({ moduleId }));
      const story = new CourseCatalogStory();
      initStory(story, api);

      const response = await story.handleCallback(
        `wish:${moduleId}`,
        actor,
        session,
      );

      expect(response.notify?.kind).toBe('warn');
      expect(String(response.notify?.text)).toContain('не найден');
      expect(response.screen).toBeUndefined();
    });
  });

  // ── Желание пройти курс (кнопка apply на карточке курса) ──

  describe('apply — желание пройти курс', () => {
    const courseId = 'c1';

    function makeApplyApi(answer: Result<unknown, DomainError>) {
      return dmgDispatch({
        [CreateCourseWishUcDef.name]: () => answerOf(answer),
      });
    }

    function makeCatalogApi(
      wishes: Array<{
        userId: string;
        target:
          | { kind: 'course'; courseId: string }
          | { kind: 'module'; moduleId: string };
        status: string;
      }> = [],
    ) {
      return makeAppApi(
        [
          courseView({
            uuid: courseId,
            title: 'JS Basics',
            description: '...',
            stages: [stage('Синтаксис', [])],
          }),
        ],
        {},
        {},
        {},
        wishes,
      );
    }

    test('list: кнопка «🎓 Хочу пройти курс» на карточке курса (желания нет)', async () => {
      const appApi = makeCatalogApi();
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback('list', actor, session);
      assertDialogResponseMarkdownSafe(response);

      const rows = response.screen?.keyboard?.rows ?? [];
      const applyBtn = rows
        .flat()
        .find((b) => b.text.includes('Хочу пройти курс'));
      expect(applyBtn).toBeDefined();
      expect(applyBtn!.code).toBe(`course-catalog:apply:${courseId}`);
    });

    test.each(['expressed', 'confirmed'] as const)(
      'list: %s-желание → кнопка «🗑️ Отменить желание» (W05)',
      async (status) => {
        const appApi = makeCatalogApi([
          {
            userId: actor.uuid,
            target: { kind: 'course', courseId },
            status,
          },
        ]);
        const story = new CourseCatalogStory();
        initStory(story, appApi);

        const response = await story.handleCallback('list', actor, session);
        const buttons = (response.screen?.keyboard?.rows ?? []).flat();

        expect(
          buttons.some(
            (b) =>
              b.text.includes('Отменить желание') &&
              b.code === `course-catalog:cancel:${courseId}`,
          ),
        ).toBe(true);
        expect(buttons.some((b) => b.text.includes('Хочу пройти курс'))).toBe(
          false,
        );
      },
    );

    test('apply instant: вызывает create-course-wish и рендерит W03', async () => {
      const appApi = makeApplyApi(ok({ outcome: 'instant' }));
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `apply:${courseId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(ucCall(appApi, CreateCourseWishUcDef.name)).toEqual({
        input: { courseId },
        subject: actor,
      });

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('зафиксировано');
      expect(text).toContain('когда откроется набор');
      const rows = response.screen?.keyboard?.rows ?? [];
      const menuBtn = rows.flat().find((b) => b.text.includes('Главное меню'));
      expect(menuBtn?.code).toBe(Routes.app.mainMenu);
    });

    test('apply questionnaire: пустой ответ — анкету рендерит FillStory', async () => {
      const appApi = makeApplyApi(ok({ outcome: 'questionnaire' }));
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `apply:${courseId}`,
        actor,
        session,
      );

      expect(ucCall(appApi, CreateCourseWishUcDef.name).input).toEqual({
        courseId,
      });
      // Стори ничего не отправляет — анкету проактивно рендерит FillStory
      expect(response.screen).toBeUndefined();
      expect(response.notify).toBeUndefined();
    });

    test.each(['expressed', 'confirmed'] as const)(
      'apply конфликт %s: W04 с кнопкой отмены и меню',
      async (status) => {
        const appApi = makeApplyApi(
          WishErrors.ALREADY_EXISTS.err({
            userId: actor.uuid,
            courseId,
            status,
          }),
        );
        const story = new CourseCatalogStory();
        initStory(story, appApi);

        const response = await story.handleCallback(
          `apply:${courseId}`,
          actor,
          session,
        );
        assertDialogResponseMarkdownSafe(response);

        const text = String(response.screen?.text ?? '');
        expect(text).not.toContain('⚠️');
        // Текст ветвится по статусу: обучение или выразил желание
        expect(text).toContain(
          status === 'confirmed' ? 'обучаешься' : 'выразил желание',
        );
        const rows = response.screen?.keyboard?.rows ?? [];
        const flat = rows.flat();
        expect(flat.some((b) => b.text.includes('Отменить желание'))).toBe(
          true,
        );
        expect(
          flat.some((b) => b.code === `course-catalog:cancel:${courseId}`),
        ).toBe(true);
        expect(flat.some((b) => b.code === Routes.app.mainMenu)).toBe(true);
      },
    );

    test('apply конфликт pending: W04 — продолжить анкету', async () => {
      const appApi = makeApplyApi(
        WishErrors.ALREADY_EXISTS.err({
          userId: actor.uuid,
          courseId,
          status: 'pending',
        }),
      );
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `apply:${courseId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('начал заполнять анкету');
      expect(text).toContain('не закончил');
      const rows = response.screen?.keyboard?.rows ?? [];
      const flat = rows.flat();
      const resumeBtn = flat.find((b) => b.text.includes('Продолжить анкету'));
      expect(resumeBtn?.code).toBe(`questionnaire:fill:resume:${courseId}`);
      expect(flat.some((b) => b.code === Routes.app.mainMenu)).toBe(true);
    });

    test('apply: другая ошибка (курс не найден) — errorNotify (warn-реплика)', async () => {
      const appApi = makeApplyApi(
        WishErrors.COURSE_NOT_FOUND.err({ courseId }),
      );
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `apply:${courseId}`,
        actor,
        session,
      );

      expect(response.notify?.kind).toBe('warn');
      expect(String(response.notify?.text)).toContain('не найден');
      expect(response.screen).toBeUndefined();
    });
  });

  describe('cancel — отмена желания (W05)', () => {
    const courseId = 'c1';

    function makeCancelApi(error?: Err<DomainError>) {
      return dmgDispatch({
        [CancelWishUcDef.name]: () => answerOf(error ?? ok(undefined)),
      });
    }

    const moduleId = '33333333-3333-4333-8333-333333333333';

    test.each([
      [
        'cancel',
        courseId,
        'Отменить желание пройти курс?',
        `course-catalog:cancel-confirm:${courseId}`,
        `course-catalog:course:${courseId}`,
      ],
      [
        'cancel-mod',
        moduleId,
        'Отменить желание пройти модуль?',
        `course-catalog:cancel-mod-confirm:${moduleId}`,
        Routes.app.mainMenu,
      ],
    ])(
      '%s: подтверждение W05 с кнопками Да/Отмена',
      async (action, target, confirmText, confirmCode, cancelCode) => {
        const appApi = makeCancelApi();
        const story = new CourseCatalogStory();
        initStory(story, appApi);

        const response = await story.handleCallback(
          `${action}:${target}`,
          actor,
          session,
        );
        assertDialogResponseMarkdownSafe(response);

        const text = String(response.screen?.text ?? '');
        expect(text).toContain(confirmText);
        const flat = (response.screen?.keyboard?.rows ?? []).flat();
        const yes = flat.find((b) => b.text.includes('Да'));
        expect(yes?.code).toBe(confirmCode);
        const no = flat.find((b) => b.text.includes('Отмена'));
        expect(no?.code).toBe(cancelCode);
      },
    );

    test('cancel-confirm: вызывает cancel-wish и сообщает об отмене', async () => {
      const appApi = makeCancelApi();
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `cancel-confirm:${courseId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(ucCall(appApi, CancelWishUcDef.name)).toEqual({
        input: { kind: 'course', courseId },
        subject: actor,
      });

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('отменено');
      const rows = response.screen?.keyboard?.rows ?? [];
      const menuBtn = rows.flat().find((b) => b.text.includes('Главное меню'));
      expect(menuBtn?.code).toBe(Routes.app.mainMenu);
    });

    test('cancel-confirm: WISH_NOT_FOUND — мягкое сообщение без ошибки', async () => {
      const appApi = makeCancelApi(
        WishErrors.NOT_FOUND.err({ userId: actor.uuid, courseId }),
      );
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `cancel-confirm:${courseId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text ?? '');
      expect(text).not.toContain('⚠️');
      expect(text).toContain('уже нет');
    });
  });

  describe('cancel-mod — отмена желания модуля (W05-M)', () => {
    const moduleId = '33333333-3333-4333-8333-333333333333';

    function makeCancelApi(error?: Err<DomainError>) {
      return dmgDispatch({
        [CancelWishUcDef.name]: () => answerOf(error ?? ok(undefined)),
      });
    }

    test('cancel-mod-confirm: вызывает cancel-wish с вариантом module', async () => {
      const appApi = makeCancelApi();
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `cancel-mod-confirm:${moduleId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      expect(ucCall(appApi, CancelWishUcDef.name)).toEqual({
        input: { kind: 'module', moduleId },
        subject: actor,
      });

      const text = String(response.screen?.text ?? '');
      expect(text).toContain('отменено');
    });

    test('cancel-mod-confirm: WISH_NOT_FOUND — мягкое сообщение без ошибки', async () => {
      const appApi = makeCancelApi(
        WishErrors.NOT_FOUND.err({ userId: actor.uuid, moduleId }),
      );
      const story = new CourseCatalogStory();
      initStory(story, appApi);

      const response = await story.handleCallback(
        `cancel-mod-confirm:${moduleId}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text ?? '');
      expect(text).not.toContain('⚠️');
      expect(text).toContain('уже нет');
    });
  });

  // ── Навигация: листание соседних сущностей (drill-down) ──

  describe('Листание соседей (drill-down навигация)', () => {
    test('drill-down сохраняет контекст курса, если модуль входит в несколько курсов', async () => {
      const sharedModId = 'shared-mod';
      const courses = [
        courseView({
          uuid: 'course-first',
          title: 'Основы программирования',
          description: 'Первый курс',
          stages: [stage('Этап 1', [sharedModId])],
        }),
        courseView({
          uuid: 'course-second',
          title: 'Тест курс (v2)',
          description: 'Второй курс',
          stages: [stage('Этап 1', [sharedModId])],
        }),
      ];
      const appApi = makeAppApi(
        courses,
        {
          [sharedModId]: moduleView({
            uuid: sharedModId,
            title: 'Общий модуль',
            description: '...',
            projects: [],
          }),
        },
        {
          [sharedModId]: [
            {
              projectId: 'proj-1',
              projectTitle: 'Тестовый проект',
              lessons: [
                {
                  lessonId: 'les-1',
                  lessonTitle: 'Тестовый урок',
                  stepIds: ['s1'],
                },
              ],
            },
          ],
        },
        {
          'les-1': [{ uuid: 's1', description: 'Шаг 1' }],
        },
      );

      const story = new CourseCatalogStory();
      initStory(story, appApi);

      // 1. Заходим в проект второго курса по новому адресу prj:courseId:modId:projId
      const projResp = await story.handleCallback(
        `prj:course-second:${sharedModId}:proj-1`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(projResp);
      const projText = String(projResp.screen?.text ?? '');
      // Должен быть именно второй курс «Тест курс (v2)», а не первый!
      expect(projText).toContain('Тест курс');
      expect(projText).not.toContain('Основы программирования');

      // Кнопка «Назад к модулю» должна вести во второй курс
      const projBtns = projResp.screen?.keyboard?.rows.flat() ?? [];
      const backToModBtn = projBtns.find((b) =>
        b.text.includes('Назад к модулю'),
      );
      expect(backToModBtn).toBeDefined();
      expect(backToModBtn?.code).toContain('course-second');

      // 2. Переходим в урок второго курса
      const lesResp = await story.handleCallback(
        `les:course-second:proj-1:les-1`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(lesResp);
      const lesText = String(lesResp.screen?.text ?? '');
      expect(lesText).toContain('Тест курс');
      expect(lesText).not.toContain('Основы программирования');

      // Кнопка «Назад к проекту» должна содержать course-second
      const lesBtns = lesResp.screen?.keyboard?.rows.flat() ?? [];
      const backToProjBtn = lesBtns.find((b) =>
        b.text.includes('Назад к проекту'),
      );
      expect(backToProjBtn).toBeDefined();
      expect(backToProjBtn?.code).toContain('course-second');
    });
  });
});
