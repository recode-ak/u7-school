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
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/domain/user/testing';
import type { WishState } from '@u7-scl/domain/wish/testing';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import type {
  PersonDef,
  StreamDef,
  StudentDef,
  WorldDefinition,
} from '../worlds';
import { deterministicUuid } from '../worlds/uuid';

/**
 * E2E админских экранов бота: админ без роли MENTOR видит всё содержимое
 * (менторская карточка чужого потока, мониторинг, каталог), но создать
 * поток не может — `StreamPolicy.canCreate` = только MENTOR (Q-12).
 *
 * Мир — производный: `admin` (только ADMIN), менторы `dev` (свои потоки) и
 * `mentor2` (не владелец — для сравнения режима карточки), курсы с
 * желаниями админа во всех статусах карточки курса (W01).
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const ANCHOR = new Date('2026-10-01T12:00:00.000Z');

const COURSE_ID = 'cb200001-0000-4000-8000-000000000001';
const MODULE_ID = 'ab200001-0000-4000-8000-000000000001';
const PROJECT_ID = 'bb200001-0000-4000-8000-000000000001';
const LESSON_ID = 'cb200001-0000-4000-8000-000000000002';
const STEP1_ID = 'db200001-0000-4000-8000-000000000001';
const STEP2_ID = 'db200002-0000-4000-8000-000000000002';

const COURSE_PENDING_ID = 'cb200002-0000-4000-8000-000000000003';
const COURSE_EXPRESSED_ID = 'cb200002-0000-4000-8000-000000000004';

const streamId = (key: string): string => deterministicUuid(`stream:${key}`);
const studentId = (key: string): string => deterministicUuid(`student:${key}`);
const userId = (key: string): string => deterministicUuid(`person:${key}`);

const WISH_CREATED_AT = Date.UTC(2026, 8, 20, 12, 0, 0);

const TG = {
  admin: 1005,
  mentor: 1004,
  otherMentor: 1009,
  active: 1201,
  advanced: 1202,
};

function mentorPerson(
  key: string,
  name: string,
  telegramId: number,
): PersonDef {
  return {
    key,
    name,
    telegramId,
    roles: [Role.MENTOR, Role.AUTHOR],
    registeredAt: 'T-90d',
  };
}

function wish(
  uuid: string,
  courseId: string,
  status: 'pending' | 'expressed',
): WishState {
  return {
    uuid,
    userId: userId('admin'),
    target: { kind: 'course', courseId },
    status,
    createdAt: WISH_CREATED_AT,
    updatedAt: WISH_CREATED_AT,
    version: 0,
  };
}

const ADMIN_WORLD: WorldDefinition = {
  name: 'admin-screens',
  description: 'Админ без роли ментора: чужие потоки, каталог, желания',
  anchorDate: ANCHOR,
  persons: [
    {
      key: 'admin',
      name: 'Администратор',
      telegramId: TG.admin,
      roles: [Role.ADMIN],
      registeredAt: 'T-90d',
    },
    mentorPerson('dev', 'Ментор', TG.mentor),
    mentorPerson('mentor2', 'Второй ментор', TG.otherMentor),
    {
      key: 'learner-active',
      name: 'Активный',
      telegramId: TG.active,
      roles: [Role.GUEST],
      registeredAt: 'T-90d',
    },
    {
      key: 'learner-advanced',
      name: 'Завершивший',
      telegramId: TG.advanced,
      roles: [Role.GUEST],
      registeredAt: 'T-90d',
    },
  ],
  courses: [
    {
      key: 'course-admin',
      uuid: COURSE_ID,
      title: 'Курс админа',
      description: 'Курс с программой для drill-down админом.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-admin',
          uuid: MODULE_ID,
          title: 'Модуль админа',
          projects: [
            {
              key: 'proj-admin',
              uuid: PROJECT_ID,
              title: 'Проект админа',
              lessons: [
                {
                  key: 'lesson-admin',
                  uuid: LESSON_ID,
                  title: 'Урок админа',
                  steps: [
                    {
                      key: 'step-one',
                      uuid: STEP1_ID,
                      description: 'Первый шаг',
                      content: 'Тело первого шага.',
                    },
                    {
                      key: 'step-two',
                      uuid: STEP2_ID,
                      description: 'Второй шаг',
                      content: 'Тело второго шага.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'course-pending',
      uuid: COURSE_PENDING_ID,
      title: 'Курс с черновиком анкеты',
      description: 'Курс, на который у админа есть черновик анкеты.',
      authorKey: 'dev',
    },
    {
      key: 'course-expressed',
      uuid: COURSE_EXPRESSED_ID,
      title: 'Курс с желанием',
      description: 'Курс, на который у админа выражено желание.',
      authorKey: 'dev',
    },
  ],
  streams: [
    {
      key: 'stream-enrollment',
      uuid: streamId('stream-enrollment'),
      title: 'Поток набора',
      description: 'Поток чужого ментора в наборе.',
      courseKey: 'course-admin',
      moduleKey: 'mod-admin',
      mentorKey: 'dev',
      status: 'enrollment',
      startedAt: 'T-20d',
      telegramGroupId: '-1006666666601',
    } satisfies StreamDef,
    {
      key: 'stream-active',
      uuid: streamId('stream-active'),
      title: 'Поток в обучении',
      description: 'Поток чужого ментора в обучении.',
      courseKey: 'course-admin',
      moduleKey: 'mod-admin',
      mentorKey: 'dev',
      status: 'active',
      startedAt: 'T-20d',
      telegramGroupId: '-1006666666602',
    } satisfies StreamDef,
  ],
  students: [
    {
      key: 'stud-active',
      uuid: studentId('stud-active'),
      personKey: 'learner-active',
      streamKey: 'stream-active',
      enrolledAt: 'T-19d',
      status: 'active',
      currentStepKey: 'step-one',
      steps: [{ stepKey: 'step-one', status: 'issued', issuedAt: 'T-18d' }],
    } satisfies StudentDef,
    {
      key: 'stud-advanced',
      uuid: studentId('stud-advanced'),
      personKey: 'learner-advanced',
      streamKey: 'stream-active',
      enrolledAt: 'T-19d',
      status: 'advanced',
      currentStepKey: 'step-two',
      steps: [
        { stepKey: 'step-one', status: 'completed', completedAt: 'T-10d' },
        { stepKey: 'step-two', status: 'completed', completedAt: 'T-9d' },
      ],
    } satisfies StudentDef,
  ],
  wishes: [
    wish('ab200001-0000-4000-8000-000000000001', COURSE_PENDING_ID, 'pending'),
    wish(
      'ab200002-0000-4000-8000-000000000002',
      COURSE_EXPRESSED_ID,
      'expressed',
    ),
  ],
};

describe('E2E: админские экраны бота', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('admin-e2e', ADMIN_WORLD);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new StreamsController(),
      new CoursesController(),
      new MentorController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  const textOf = (response: DialogResponse): string =>
    String(response.screen?.text ?? '');

  const notifyOf = (response: DialogResponse): string =>
    String(response.notify?.text ?? '');

  const buttonsOf = (response: DialogResponse): string[] =>
    response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];

  const codesOf = (response: DialogResponse): string[] =>
    response.screen?.keyboard?.rows.flat().map((b) => b.code) ?? [];

  async function press(
    tgId: number,
    textContains: string,
  ): Promise<DialogResponse> {
    return transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, textContains),
      }),
    );
  }

  /** Крафтовый адрес с актуальным штампом свежего экрана. */
  async function craft(tgId: number, rawCode: string): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    return transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: stampedCode(transport, tgId, rawCode),
      }),
    );
  }

  // ── «Мои потоки» и чужая карточка ──

  test('P5-08: админ — «Мои потоки» пуст, чужие потоки не показываются', async () => {
    await transport.handleStart(transport.makeBotContext(TG.admin));
    await press(TG.admin, 'Инструменты ментора');

    const response = await press(TG.admin, 'Мои потоки');

    expect(textOf(response)).toContain('У вас пока нет потоков');
    expect(buttonsOf(response)).toContain('⚫ Вкл. архивированные');
    expect(buttonsOf(response)).toContain('🟢 Вкл. завершённые');
    // Своих потоков нет — потоки ментора dev в списке не появляются
    expect(buttonsOf(response).some((t) => t.includes('Поток набора'))).toBe(
      false,
    );
  });

  test('P5-09: админ — менторская карточка чужого потока с lifecycle-кнопками', async () => {
    const active = await craft(
      TG.admin,
      `mentor:view-stream-mentor:view:${streamId('stream-active')}`,
    );

    const activeButtons = buttonsOf(active);
    expect(buttonsOf(active).some((t) => t.includes('Программа модуля'))).toBe(
      true,
    );
    expect(buttonsOf(active).some((t) => t.includes('Детали'))).toBe(true);
    expect(activeButtons.some((t) => t.includes('Студенты'))).toBe(true);
    expect(activeButtons).toContain('✅ Завершить');

    const enrollment = await craft(
      TG.admin,
      `mentor:view-stream-mentor:view:${streamId('stream-enrollment')}`,
    );
    expect(buttonsOf(enrollment)).toContain('🚀 Запустить');
  });

  test('P5-10: админ в публичной карточке — режим ментора, тело шага открыто; чужому ментору — нет', async () => {
    // Админ: публичная карточка → программа → проект → урок → шаг
    await transport.handleStart(transport.makeBotContext(TG.admin));
    await transport.handleCallback(
      transport.makeBotContext(TG.admin, {
        callbackData: stampedCode(
          transport,
          TG.admin,
          `stream:view-stream:view:${streamId('stream-active')}`,
        ),
      }),
    );
    await press(TG.admin, 'Программа модуля');
    await press(TG.admin, 'Проект админа');
    const lesson = await press(TG.admin, 'Урок админа');
    expect(textOf(lesson)).toContain('Шаги урока');
    // Шаги открываются на чтение только в режиме ментора
    expect(buttonsOf(lesson).some((t) => t.includes('Первый шаг'))).toBe(true);

    const step = await press(TG.admin, 'Первый шаг');
    expect(textOf(step)).toContain('Тело первого шага');

    // Ментор не владелец и не админ: шаги не открываются
    await transport.handleStart(transport.makeBotContext(TG.otherMentor));
    await transport.handleCallback(
      transport.makeBotContext(TG.otherMentor, {
        callbackData: stampedCode(
          transport,
          TG.otherMentor,
          `stream:view-stream:view:${streamId('stream-active')}`,
        ),
      }),
    );
    await press(TG.otherMentor, 'Программа модуля');
    await press(TG.otherMentor, 'Проект админа');
    const viewerLesson = await press(TG.otherMentor, 'Урок админа');
    expect(buttonsOf(viewerLesson).some((t) => t.includes('Первый шаг'))).toBe(
      false,
    );

    const denied = await transport.handleCallback(
      transport.makeBotContext(TG.otherMentor, {
        callbackData: stampedCode(
          transport,
          TG.otherMentor,
          `stream:view-stream:prog:${streamId('stream-active')}:step:${STEP1_ID}`,
        ),
      }),
    );
    expect(textOf(denied)).toContain('Тела шагов недоступны');
  });

  test('P5-11: админ — «Студенты» чужого потока: действия ⛔✅, фильтр выбывших, 🔄', async () => {
    const list = await craft(
      TG.admin,
      `mentor:monitor:students:${streamId('stream-active')}`,
    );

    expect(textOf(list)).toContain('Студенты потока');
    expect(buttonsOf(list)).toContain('⛔');
    expect(buttonsOf(list)).toContain('✅');
    expect(buttonsOf(list).some((t) => t.includes('Показать выбывших'))).toBe(
      true,
    );

    const all = await press(TG.admin, 'Показать выбывших');
    expect(textOf(all)).toContain('Студенты потока');
    expect(buttonsOf(all)).toContain('🔄');
  });

  test('P5-12: админ — «Создать поток»: визард открыт, UC отказывает в правах', async () => {
    await transport.handleStart(transport.makeBotContext(TG.admin));
    await press(TG.admin, 'Инструменты ментора');
    await press(TG.admin, 'Создать поток');

    const modules = await press(TG.admin, 'Модуль админа');
    expect(textOf(modules)).toContain('название потока');
    await press(TG.admin, 'Принять');
    await press(TG.admin, 'Принять');
    await transport.sendText(TG.admin, '2026-12-15');
    for (let i = 0; i < 5; i++) await press(TG.admin, 'Пропустить');
    await press(TG.admin, 'Пропустить');
    await press(TG.admin, 'Пропустить');
    const preview = await press(TG.admin, 'Пропустить');
    expect(textOf(preview)).toContain('Превью потока');

    const refused = await press(TG.admin, 'Создать');

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain(
      'Недостаточно прав для создания потока',
    );
  });

  // ── Каталог курсов ──

  test('P5-13: админ — каталог до урока, содержимое модуля видно полностью', async () => {
    await transport.handleStart(transport.makeBotContext(TG.admin));
    const card = await press(TG.admin, 'Курсы');
    // Каталог — карусель: сразу карточка первого курса
    expect(textOf(card)).toContain('Курс админа');
    expect(textOf(card)).toContain('Модуль админа');

    const module = await press(TG.admin, 'Модуль админа');
    expect(textOf(module)).toContain('Проекты модуля');
    expect(textOf(module)).toContain('Проект админа');

    const project = await press(TG.admin, 'Проект админа');
    expect(textOf(project)).toContain('Уроки проекта');

    const lesson = await press(TG.admin, 'Урок админа');
    expect(textOf(lesson)).toContain('Шаги урока');
    expect(textOf(lesson)).toContain('Первый шаг');
  });

  test('P5-14: уровень «Урок» в каталоге — шаги заголовками, тела шага нет', async () => {
    await transport.handleStart(transport.makeBotContext(TG.admin));
    await press(TG.admin, 'Курсы');
    await press(TG.admin, 'Модуль админа');
    await press(TG.admin, 'Проект админа');

    const lesson = await press(TG.admin, 'Урок админа');

    // Наблюдаемое сейчас: шаги — только заголовки, адреса шага нет ни у
    // одной роли (UC сводки шага `content`/`code` удалён без вызывающих)
    expect(textOf(lesson)).toContain('Первый шаг');
    expect(textOf(lesson)).not.toContain('Тело первого шага');
    expect(codesOf(lesson).some((c) => c.includes(STEP1_ID))).toBe(false);
  });

  test('P5-15: карточка курса у админа — wish-кнопки как у студента', async () => {
    await transport.handleStart(transport.makeBotContext(TG.admin));

    const noWish = await press(TG.admin, 'Курсы');
    expect(textOf(noWish)).toContain('Курс админа');
    expect(buttonsOf(noWish)).toContain('🎓 Хочу пройти курс');

    const pending = await press(TG.admin, 'След. курс');
    expect(textOf(pending)).toContain('Курс с черновиком анкеты');
    expect(buttonsOf(pending)).toContain('📝 Продолжить анкету');

    const expressed = await press(TG.admin, 'След. курс');
    expect(textOf(expressed)).toContain('Курс с желанием');
    expect(buttonsOf(expressed)).toContain('🗑️ Отменить желание');
  });
});
