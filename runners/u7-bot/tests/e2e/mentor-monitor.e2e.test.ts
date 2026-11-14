import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/domain/user/testing';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
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
 * E2E отказы мониторинга (S07/S08): снятие и завершение студента чужим
 * ментором, недопустимый исход, заглушка истории, несуществующий поток.
 *
 * Мир — производный: поток ментора `dev` с активным студентом; `mentor2` —
 * чужой ментор без прав на поток (отказы прав). Прямые адреса monitor-стори
 * (`monitor:history`, недопустимый исход) нажимаются крафтовым кодом с
 * актуальным штампом экрана — из UI эти ветки недостижимы (Q-11).
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const ANCHOR = new Date('2026-10-01T12:00:00.000Z');

const COURSE_ID = 'cb100001-0000-4000-8000-000000000001';
const MODULE_ID = 'ab100001-0000-4000-8000-000000000001';
const PROJECT_ID = 'bb100001-0000-4000-8000-000000000001';
const LESSON_ID = 'cb100001-0000-4000-8000-000000000002';
const STEP1_ID = 'db100001-0000-4000-8000-000000000001';
const STEP2_ID = 'db100002-0000-4000-8000-000000000002';
const UNKNOWN_STREAM_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const streamId = (key: string): string => deterministicUuid(`stream:${key}`);
const studentId = (key: string): string => deterministicUuid(`student:${key}`);

const TG = {
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

function learner(key: string, name: string, telegramId: number): PersonDef {
  return { key, name, telegramId, roles: [Role.GUEST], registeredAt: 'T-90d' };
}

const liveStream: StreamDef = {
  key: 'stream-live',
  uuid: streamId('stream-live'),
  title: 'Поток мониторинга',
  description: 'Поток для e2e отказов мониторинга.',
  courseKey: 'course-monitor',
  moduleKey: 'mod-monitor',
  mentorKey: 'dev',
  status: 'active',
  startedAt: 'T-20d',
  telegramGroupId: '-1007777777701',
};

const MONITOR_WORLD: WorldDefinition = {
  name: 'mentor-monitor',
  description: 'Поток ментора dev с активным и завершённым студентами',
  anchorDate: ANCHOR,
  persons: [
    mentorPerson('dev', 'Ментор', TG.mentor),
    mentorPerson('mentor2', 'Второй ментор', TG.otherMentor),
    learner('learner-active', 'Активный', TG.active),
    learner('learner-advanced', 'Завершивший', TG.advanced),
  ],
  courses: [
    {
      key: 'course-monitor',
      uuid: COURSE_ID,
      title: 'Курс «Мониторинг»',
      description: 'Курс для e2e мониторинга.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-monitor',
          uuid: MODULE_ID,
          title: 'Модуль «Мониторинг»',
          projects: [
            {
              key: 'proj-monitor',
              uuid: PROJECT_ID,
              title: 'Проект мониторинга',
              lessons: [
                {
                  key: 'lesson-monitor',
                  uuid: LESSON_ID,
                  title: 'Урок мониторинга',
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
  ],
  streams: [liveStream],
  students: [
    {
      key: 'stud-active',
      uuid: studentId('stud-active'),
      personKey: 'learner-active',
      streamKey: 'stream-live',
      enrolledAt: 'T-19d',
      status: 'active',
      currentStepKey: 'step-one',
      steps: [{ stepKey: 'step-one', status: 'issued', issuedAt: 'T-18d' }],
    } satisfies StudentDef,
    {
      key: 'stud-advanced',
      uuid: studentId('stud-advanced'),
      personKey: 'learner-advanced',
      streamKey: 'stream-live',
      enrolledAt: 'T-19d',
      status: 'advanced',
      currentStepKey: 'step-two',
      steps: [
        { stepKey: 'step-one', status: 'completed', completedAt: 'T-10d' },
        { stepKey: 'step-two', status: 'completed', completedAt: 'T-9d' },
      ],
    } satisfies StudentDef,
  ],
};

describe('E2E: отказы мониторинга студентов', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let tgId: number;
  let otherTgId: number;

  beforeAll(async () => {
    app = await createTestApp('mentor-monitor-e2e', MONITOR_WORLD);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new MentorController(),
    ]);
    tgId = TG.mentor;
    otherTgId = TG.otherMentor;
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

  /** Крафтовый адрес с актуальным штампом открытого экрана. */
  async function craft(id: number, rawCode: string): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(id));
    return transport.pressRaw(id, rawCode);
  }

  /** /start → «Инструменты ментора» → «Мои потоки» → карточка → «Студенты». */
  async function openMonitor(id: number): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(id));
    await transport.press(id, 'Инструменты ментора');
    await transport.press(id, 'Мои потоки');
    await transport.press(id, 'Поток мониторинга');
    return transport.press(id, 'Студенты');
  }

  // ── Отказы прав ──

  test('P4-27: снятие студента чужим ментором — отказ UC репликой warn', async () => {
    // У чужого ментора нет своих потоков: адрес мониторинга набирается
    // вручную (кнопки управления ему и не показываются — права проверяет UC)
    const refused = await craft(
      otherTgId,
      `mentor:monitor:mark-abandoned-confirm:${studentId('stud-active')}`,
    );

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain(
      'Недостаточно прав для снятия студента с учёбы',
    );
  });

  test('P4-32: завершение студента чужим ментором — отказ UC репликой warn', async () => {
    const refused = await craft(
      otherTgId,
      `mentor:monitor:complete-confirm-confirm:${studentId('stud-active')}:advanced`,
    );

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain(
      'Недостаточно прав для завершения студента',
    );
  });

  // ── Ветки экранов ──

  test('P4-31: подтверждение завершения с недопустимым исходом — «Неизвестный исход»', async () => {
    await openMonitor(tgId);

    const response = await craft(
      tgId,
      `mentor:monitor:complete-confirm-confirm:${studentId('stud-active')}:unknown`,
    );

    expect(textOf(response)).toContain('Неизвестный исход');
  });

  test('P4-33: `monitor:history` — заглушка «История шагов ещё не реализована»', async () => {
    await openMonitor(tgId);

    const response = await craft(
      tgId,
      `mentor:monitor:history:${studentId('stud-active')}`,
    );

    expect(textOf(response)).toContain('История шагов ещё не реализована');
    expect(textOf(response)).toContain('скоро будет');
  });

  test('P4-34: мониторинг несуществующего потока — реплика warn «Поток не найден»', async () => {
    await openMonitor(tgId);

    const response = await craft(
      tgId,
      `mentor:monitor:students:${UNKNOWN_STREAM_ID}`,
    );

    expect(response.notify?.kind).toBe('warn');
    expect(notifyOf(response)).toContain('Поток не найден');
  });

  // P4-35 «студент без профиля пользователя» — эскалация: мир с таким
  // студентом не собрать (инвариант STUDENT_USER_NOT_FOUND в
  // tests/worlds/invariants.ts), UC зачисления пишет только вызывающего.
  // Ветка fallback-имени покрыта unit-тестом стори.
});
