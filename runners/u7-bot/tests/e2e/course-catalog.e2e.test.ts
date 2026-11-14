import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Screen } from '@u7-scl/test-helpers/screen';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** `course-js-basics`: два этапа, модуль «JavaScript Основы» в первом. */
const COURSE_JS_BASICS = 'fafafafa-baba-4aba-8aba-babababababa';
/** `course-algorithms`: один модуль (второй модуль программы js-basics). */
const COURSE_ALGORITHMS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
/** `course-test-wish`: один этап, тот же модуль «JavaScript Основы». */
const COURSE_WITH_SHARED_MODULE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const MODULE_JS_SYNTAX = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
const PROJECT_INTRO = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
const LESSON_VARIABLES = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';

const UNKNOWN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** Экранный текст ответа. */
function textOf(response: DialogResponse): string {
  return String(response.screen?.text ?? '');
}

/** /start → «📖 Курсы»: каталог открыт, экран готов к нажатиям. */
async function openCatalog(
  transport: TestBotTransport,
  tgId: number,
): Promise<DialogResponse> {
  await transport.handleStart(transport.makeBotContext(tgId));
  return transport.press(tgId, 'Курсы');
}

/**
 * E2E: каталог курсов (S00, drill-down курс → этап → модуль → проект → урок).
 *
 * Гость проходит каталог кнопками от штампованных кодов Api-записей и
 * попадает в отказы по адресам вручную (курс/этап/модуль/проект/урок не
 * найдены). Ветки экранов на моках — unit-уровень; здесь — путь сценария.
 */
describe('E2E: каталог курсов', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  const tgId = 1001;

  beforeAll(async () => {
    app = await createTestApp('course-catalog-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P2-04: неизвестный курс — «Курс не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:course:${UNKNOWN_ID}`,
    );

    expect(textOf(response)).toContain('Курс не найден или недоступен');
  });

  test('P2-07: legacy `phases:<courseId>` — та же карточка курса', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:phases:${COURSE_JS_BASICS}`,
    );

    const text = textOf(response);
    expect(text).toContain('Основы программирования');
    expect(text).toContain('Этапы курса');
  });

  test('P2-09: `phase` без courseId — «Курс не указан»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      'course:course-catalog:phase',
    );

    expect(textOf(response)).toContain('Курс не указан');
  });

  test('P2-10: `phase` с неизвестным курсом — «Курс не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:phase:${UNKNOWN_ID}:0`,
    );

    expect(textOf(response)).toContain('Курс не найден или недоступен');
  });

  test('P2-11: `phase` с несуществующим индексом этапа — «Этап не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:phase:${COURSE_JS_BASICS}:99`,
    );

    expect(textOf(response)).toContain('Этап не найден или недоступен');
  });

  test('P2-12: «◀️ Пред. этап» / «След. этап ▶️» в пределах курса', async () => {
    const course = await openCatalog(transport, tgId);
    expect(textOf(course)).toContain('Этапы курса');

    const second = await transport.press(tgId, 'Алгоритмика');
    expect(textOf(second)).toContain('Этап 2/2');
    expect(Screen.of(second).texts()).toContainEqual(
      expect.stringContaining('Пред. этап'),
    );
    // На границе курса кнопки «дальше» нет
    expect(
      Screen.of(second)
        .texts()
        .some((t) => t.includes('След. этап')),
    ).toBe(false);

    const first = await transport.press(tgId, 'Пред. этап');
    expect(textOf(first)).toContain('Этап 1/2');
    expect(Screen.of(first).texts()).toContainEqual(
      expect.stringContaining('След. этап'),
    );
    expect(
      Screen.of(first)
        .texts()
        .some((t) => t.includes('Пред. этап')),
    ).toBe(false);
  });

  test('P2-14: legacy `modules:<courseId>:<phaseIdx>` — карточка этапа', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:modules:${COURSE_JS_BASICS}:0`,
    );

    const text = textOf(response);
    expect(text).toContain('Этап 1/2: Синтаксис');
    expect(text).toContain('Модули этапа');
  });

  test('P2-16: `module` без moduleId — «Модуль не указан»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:module:${COURSE_JS_BASICS}:0`,
    );

    expect(textOf(response)).toContain('Модуль не указан');
  });

  test('P2-17: `module`, курс не определился даже по модулю — «Курс не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:module:${UNKNOWN_ID}:0:${UNKNOWN_ID}`,
    );

    expect(textOf(response)).toContain('Курс не найден или недоступен');
  });

  test('P2-18: `module`, снимок модуля недоступен — «Модуль не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:module:${COURSE_JS_BASICS}:0:${UNKNOWN_ID}`,
    );

    expect(textOf(response)).toContain('Модуль не найден или недоступен');
  });

  test('P2-19: `module` не из этапа — «Модуль не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    // Модуль «JavaScript Основы» входит в программу js-basics, но не в курс алгоритмов
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:module:${COURSE_ALGORITHMS}:0:${MODULE_JS_SYNTAX}`,
    );

    expect(textOf(response)).toContain('Модуль не найден или недоступен');
  });

  test('P2-22: legacy `projects:<courseId>:<phaseIdx>:<moduleId>` — карточка модуля', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:projects:${COURSE_JS_BASICS}:0:${MODULE_JS_SYNTAX}`,
    );

    const text = textOf(response);
    expect(text).toContain('Проекты модуля');
    expect(text).toContain('JavaScript Основы');
  });

  test('P2-25: `prj`, снимок модуля недоступен — «Модуль не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:prj:${COURSE_JS_BASICS}:${UNKNOWN_ID}:${PROJECT_INTRO}`,
    );

    expect(textOf(response)).toContain('Модуль не найден или недоступен');
  });

  test('P2-26: `prj`, проекта нет в модуле — «Проект не найден»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:prj:${COURSE_JS_BASICS}:${MODULE_JS_SYNTAX}:${UNKNOWN_ID}`,
    );

    expect(textOf(response)).toContain('Проект не найден');
  });

  test('P2-29: legacy `lessons:<courseId>:<phaseIdx>:<moduleId>:<projectIdx>` — карточка проекта', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:lessons:${COURSE_JS_BASICS}:0:${MODULE_JS_SYNTAX}:0`,
    );

    const text = textOf(response);
    expect(text).toContain('Уроки проекта');
    expect(text).toContain('Введение');

    // Несуществующий индекс проекта — «Проект не найден»
    const missing = await transport.pressRaw(
      tgId,
      `course:course-catalog:lessons:${COURSE_JS_BASICS}:0:${MODULE_JS_SYNTAX}:99`,
    );
    expect(textOf(missing)).toContain('Проект не найден');
  });

  test('P2-31: `les`, проект не найден ни в одном модуле курса — «Модуль не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:les:${COURSE_JS_BASICS}:${UNKNOWN_ID}:${LESSON_VARIABLES}`,
    );

    expect(textOf(response)).toContain('Модуль не найден или недоступен');
  });

  test('P2-32: `les`, проекта нет в снимке модуля — «Проект не найден»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:les:${COURSE_JS_BASICS}:${MODULE_JS_SYNTAX}:${UNKNOWN_ID}:${LESSON_VARIABLES}`,
    );

    expect(textOf(response)).toContain('Проект не найден');
  });

  test('P2-33: `les`, урока нет в проекте — «Урок не найден»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:les:${COURSE_JS_BASICS}:${MODULE_JS_SYNTAX}:${PROJECT_INTRO}:${UNKNOWN_ID}`,
    );

    expect(textOf(response)).toContain('Урок не найден');
  });

  test('P2-35: «◀️ Пред. урок» / «След. урок ▶️» в пределах проекта', async () => {
    await openCatalog(transport, tgId);
    await transport.press(tgId, 'Синтаксис');
    await transport.press(tgId, 'JavaScript Основы');
    await transport.press(tgId, 'Введение');

    const first = await transport.press(tgId, 'Переменные и типы');
    expect(textOf(first)).toContain('Урок 1/2');
    expect(Screen.of(first).texts()).toContainEqual(
      expect.stringContaining('След. урок'),
    );
    expect(
      Screen.of(first)
        .texts()
        .some((t) => t.includes('Пред. урок')),
    ).toBe(false);

    const second = await transport.press(tgId, 'След. урок');
    expect(textOf(second)).toContain('Урок 2/2');
    expect(textOf(second)).toContain('Условные операторы');
    expect(Screen.of(second).texts()).toContainEqual(
      expect.stringContaining('Пред. урок'),
    );
    expect(
      Screen.of(second)
        .texts()
        .some((t) => t.includes('След. урок')),
    ).toBe(false);
  });

  test('P2-37: тело шага на уровне урока не показывается — только заголовки', async () => {
    await openCatalog(transport, tgId);
    await transport.press(tgId, 'Синтаксис');
    await transport.press(tgId, 'JavaScript Основы');
    await transport.press(tgId, 'Введение');
    const lesson = await transport.press(tgId, 'Переменные и типы');

    const text = textOf(lesson);
    expect(text).toContain('Шаги урока');
    // Заголовок шага (description) виден
    expect(text).toContain('знакомство с переменными');
    // Тело шага (content) — нет
    expect(text).not.toContain('рекомендуется объявлять переменные');
    // Кнопок входа в шаг нет: адреса с id шага не встречаются
    expect(
      Screen.of(lesson)
        .buttons()
        .some((b) => b.code.includes('d0d0d0d0-d0d0')),
    ).toBe(false);
  });

  test('P2-38: модуль в нескольких курсах — drill-down остаётся в выбранном курсе', async () => {
    await openCatalog(transport, tgId);
    const course = await transport.pressRaw(
      tgId,
      `course:course-catalog:course:${COURSE_WITH_SHARED_MODULE}`,
    );
    expect(textOf(course)).toContain('Курс 5/6');

    const module = await transport.press(tgId, 'JavaScript Основы');
    const moduleText = textOf(module);
    expect(moduleText).toContain('Проекты модуля');
    // Крошки и навигация — в контексте выбранного курса, не первого в каталоге
    expect(moduleText).toContain('Курс 5/6');
    expect(moduleText).not.toContain('Курс 1/6');

    const back = await transport.press(tgId, 'Назад к курсу');
    expect(textOf(back)).toContain('Курс 5/6');
    expect(textOf(back)).toContain('Модули этапа');
  });

  test('P2-60: неизвестный action у `course:course-catalog:*` — «Неизвестная команда»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      'course:course-catalog:xyz',
    );

    expect(textOf(response)).toContain('Неизвестная команда');
  });
});

/** Мир без курсов: каталог пуст, потоков и студентов нет. */
const WORLD_WITHOUT_COURSES: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'catalog-without-courses',
  courses: [],
  streams: [],
  students: [],
  campaigns: [],
  reviews: [],
};

describe('E2E: каталог курсов без опубликованных курсов', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  const tgId = 1001;

  beforeAll(async () => {
    app = await createTestApp(
      'course-catalog-empty-e2e',
      WORLD_WITHOUT_COURSES,
    );
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P2-03: `list` при пустом каталоге — заглушка и выход в меню', async () => {
    const response = await openCatalog(transport, tgId);

    const text = textOf(response);
    expect(text).toContain('Пока нет доступных курсов');
    expect(Screen.of(response).texts()).toContainEqual(
      expect.stringContaining('Главное меню'),
    );
  });

  test('P2-24: `prj`, курс не определён — «Курс не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:prj:${UNKNOWN_ID}:${MODULE_JS_SYNTAX}:${PROJECT_INTRO}`,
    );

    expect(textOf(response)).toContain('Курс не найден или недоступен');
  });

  test('P2-34: `les`, курс не определён — «Курс не найден или недоступен»', async () => {
    await openCatalog(transport, tgId);
    const response = await transport.pressRaw(
      tgId,
      `course:course-catalog:les:${UNKNOWN_ID}:${PROJECT_INTRO}:${LESSON_VARIABLES}`,
    );

    expect(textOf(response)).toContain('Курс не найден или недоступен');
  });
});

/**
 * Мир с курсом из двух модулей без деления на этапы: соседи модулей
 * внутри одной области (в базовом мире этапы по одному модулю).
 */
const WORLD_WITH_TWO_MODULES: WorldDefinition = {
  name: 'catalog-two-modules',
  description: 'Курс из двух модулей подряд — навигация по соседям',
  anchorDate: new Date('2026-10-01T12:00:00.000Z'),
  persons: [
    {
      key: 'dev',
      name: 'Автор',
      telegramId: 1004,
      roles: ['MENTOR', 'AUTHOR'],
    },
    {
      key: 'guest',
      name: 'Гость',
      telegramId: 1001,
      roles: ['GUEST'],
    },
  ],
  courses: [
    {
      key: 'course-two-modules',
      title: 'Курс из двух модулей',
      description: 'Два модуля одной программы без этапов.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-first',
          title: 'Первый модуль',
          projects: [
            {
              key: 'proj-first',
              title: 'Проект первого модуля',
              lessons: [
                {
                  key: 'less-first',
                  title: 'Урок первого модуля',
                  steps: [
                    {
                      key: 'step-first',
                      description: 'Шаг первого модуля',
                      content: 'Тело шага',
                    },
                  ],
                },
              ],
            },
          ],
        },
        { key: 'mod-second', title: 'Второй модуль' },
      ],
    },
  ],
};

describe('E2E: каталог курсов — соседи модулей', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  const tgId = 1001;

  beforeAll(async () => {
    app = await createTestApp(
      'course-catalog-two-modules-e2e',
      WORLD_WITH_TWO_MODULES,
    );
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P2-20: «◀️ Пред. модуль» / «След. модуль ▶️» внутри этапа', async () => {
    const course = await openCatalog(transport, tgId);
    expect(textOf(course)).toContain('Модули этапа');

    const first = await transport.press(tgId, 'Первый модуль');
    expect(textOf(first)).toContain('Модуль 1/2');
    expect(Screen.of(first).texts()).toContainEqual(
      expect.stringContaining('След. модуль'),
    );
    expect(
      Screen.of(first)
        .texts()
        .some((t) => t.includes('Пред. модуль')),
    ).toBe(false);

    const second = await transport.press(tgId, 'След. модуль');
    expect(textOf(second)).toContain('Модуль 2/2');
    expect(Screen.of(second).texts()).toContainEqual(
      expect.stringContaining('Пред. модуль'),
    );
    expect(
      Screen.of(second)
        .texts()
        .some((t) => t.includes('След. модуль')),
    ).toBe(false);
  });
});
