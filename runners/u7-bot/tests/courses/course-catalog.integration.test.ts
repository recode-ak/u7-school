import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { Role } from '@u7-scl/user/domain';
import type { WorldDefinition } from '../worlds';

/**
 * Интеграционный тест CourseCatalogStory: настоящий ApiApp с модулем курсов
 * над данными мира, без моков внутри модуля.
 *
 * Контракт «Диалог и Экран»: ассерты — по DialogResponse, захваченному на
 * границе uiApp. Переходы — кликом по кнопке предыдущего ответа (код с
 * актуальным штампом экрана).
 *
 * Здесь только то, что не проверить на моках stories: UC курса подключены
 * и дрилл-даун доходит до заголовков шагов — у курса с этапами и у курса
 * без этапов. Ветки экранов, тексты и отказы — в
 * `course-catalog.story.test.ts`, пагинация — в e2e `pagination`.
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const GUEST_TELEGRAM_ID = 1001;

/** Курс `course-js-basics` мира core-education: два этапа, модуль «JavaScript Основы» в первом. */
const JS_BASICS_COURSE_ID = 'fafafafa-baba-4aba-8aba-babababababa';

/** Мир с курсом без этапов: программа из двух модулей, `phases: []`. */
const FLAT_COURSE_WORLD: WorldDefinition = {
  name: 'course-without-stages',
  description: 'Курс без этапов: два модуля подряд',
  anchorDate: new Date('2026-10-01T12:00:00.000Z'),
  persons: [
    {
      key: 'dev',
      name: 'Автор',
      telegramId: 1004,
      roles: [Role.MENTOR, Role.AUTHOR],
    },
    {
      key: 'guest',
      name: 'Гость',
      telegramId: GUEST_TELEGRAM_ID,
      roles: [Role.GUEST],
    },
  ],
  courses: [
    {
      key: 'course-flat',
      title: 'Курс без этапов',
      description: 'Программа из двух модулей без деления на этапы.',
      authorKey: 'dev',
      phases: [],
      modules: [
        {
          key: 'mod-flat-1',
          title: 'Первый модуль',
          projects: [
            {
              key: 'proj-flat-1',
              title: 'Первый проект',
              lessons: [
                {
                  key: 'less-flat-1',
                  title: 'Первый урок',
                  steps: [
                    {
                      key: 'step-flat-1',
                      description: 'Заголовок первого шага',
                      content: 'Тело шага не показывается в каталоге',
                    },
                  ],
                },
              ],
            },
          ],
        },
        { key: 'mod-flat-2', title: 'Второй модуль' },
      ],
    },
  ],
};

/** Кнопки экрана — плоским списком. */
function buttonsOf(
  response: DialogResponse,
): Array<{ text: string; code: string }> {
  return response.screen?.keyboard?.rows.flat() ?? [];
}

/** Нажимает кнопку ответа с текстом, содержащим `fragment`, штампом текущего экрана. */
async function clickButton(
  transport: TestBotTransport,
  telegramId: number,
  response: DialogResponse,
  fragment: string,
): Promise<DialogResponse> {
  const button = buttonsOf(response).find((b) => b.text.includes(fragment));
  expect(button, `Кнопка «${fragment}» не найдена в ответе`).toBeDefined();
  return transport.handleCallback(
    transport.makeBotContext(telegramId, {
      callbackData: stampedCode(transport, telegramId, button!.code),
    }),
  );
}

/** Открывает диалог и вызывает сырой код стори с актуальным штампом. */
async function openCatalog(
  transport: TestBotTransport,
  telegramId: number,
  rawCode: string,
): Promise<DialogResponse> {
  await transport.handleStart(transport.makeBotContext(telegramId));
  return transport.handleCallback(
    transport.makeBotContext(telegramId, {
      callbackData: stampedCode(transport, telegramId, rawCode),
    }),
  );
}

describe('CourseCatalogStory (интеграционный): курс с этапами', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('course-catalog-v2');
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

  test('drill-down курса из мира: этап → модуль → проект → урок до заголовков шагов, тела скрыты', async () => {
    const tg = GUEST_TELEGRAM_ID;

    const course = await openCatalog(
      transport,
      tg,
      `course:course-catalog:course:${JS_BASICS_COURSE_ID}`,
    );
    expect(course.screen?.text).toContain('Основы программирования');
    expect(course.screen?.text).toContain('Этапы курса');

    const stage = await clickButton(transport, tg, course, 'Синтаксис');
    expect(stage.screen?.text).toContain('Этап 1/2: Синтаксис');

    const mod = await clickButton(transport, tg, stage, 'JavaScript Основы');
    expect(mod.screen?.text).toContain('Проекты модуля');
    expect(buttonsOf(mod).some((b) => b.text.includes('Назад к этапу'))).toBe(
      true,
    );

    const project = await clickButton(transport, tg, mod, 'Введение');
    expect(project.screen?.text).toContain('Уроки проекта');

    const lesson = await clickButton(
      transport,
      tg,
      project,
      'Переменные и типы',
    );
    const text = lesson.screen?.text ?? '';
    expect(text).toContain('Шаги урока');
    expect(text).toContain('1\\. знакомство с переменными');
    // Тела шагов в каталоге не видны
    expect(text).not.toContain('рекомендуется объявлять переменные');
    expect(
      buttonsOf(lesson).some((b) => b.text.includes('Назад к проекту')),
    ).toBe(true);
  });
});

describe('CourseCatalogStory (интеграционный): курс без этапов', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: User;

  beforeAll(async () => {
    app = await createTestApp('course-flat', FLAT_COURSE_WORLD);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
    ]);
    guest = (await app.userFacade.getUserByTelegramId(GUEST_TELEGRAM_ID))!;
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('модули кликабельны до урока: список модулей курса → модуль → проект → урок, этапов нет', async () => {
    const tg = guest.telegramId;

    const list = await openCatalog(transport, tg, 'course:course-catalog:list');
    expect(list.screen?.text).toContain('Курс без этапов');
    expect(list.screen?.text).toContain('Модули курса');
    expect(list.screen?.text).not.toContain('Этап');
    expect(buttonsOf(list).some((b) => b.text.includes('Второй модуль'))).toBe(
      true,
    );

    const mod = await clickButton(transport, tg, list, 'Первый модуль');
    expect(mod.screen?.text).toContain('Модуль 1/2: Первый модуль');
    expect(mod.screen?.text).not.toContain('Этап');
    expect(buttonsOf(mod).some((b) => b.text.includes('Назад к курсу'))).toBe(
      true,
    );

    const project = await clickButton(transport, tg, mod, 'Первый проект');
    expect(project.screen?.text).toContain('Уроки проекта');

    const lesson = await clickButton(transport, tg, project, 'Первый урок');
    const text = lesson.screen?.text ?? '';
    expect(text).toContain('Шаги урока');
    expect(text).toContain('Заголовок первого шага');
    expect(text).not.toContain('Этап');
    expect(text).not.toContain('Тело шага');
  });
});
