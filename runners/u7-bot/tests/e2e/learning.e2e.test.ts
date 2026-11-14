import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { LearningController } from '@u7-scl/bot/learning/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import {
  GetStudentProgressUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { Role } from '@u7-scl/domain/user/testing';
import { Screen } from '@u7-scl/test-helpers/screen';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { expectOk, testTrace } from 'dmg-core/testing';
import type {
  PersonDef,
  StepDef,
  StudentDef,
  StudentStepDef,
  WorldDefinition,
} from '../worlds';
import { deterministicUuid } from '../worlds/uuid';

/**
 * E2E «Моя учёба» (learning): хаб, прохождение шагов, программа модуля,
 * прогресс и самовыход (S05/S06, FR-4).
 *
 * Мир — производный от `core-education` по смыслу, но собран здесь целиком:
 * один курс/модуль с двумя проектами; у каждого сценария свой студент, чтобы
 * мутирующие ветки («Выполнено», «Покинуть учёбу») не влияли друг на друга.
 * Программа модуля:
 *   проект «Введение»: урок «Ввод и вывод» (шаги setup → vars),
 *                      урок «Типы данных» (шаг types, длинное тело);
 *   проект «Итоговый проект»: урок «Сдача проекта» (шаг final).
 *
 * Коды кнопок берутся отштампованными с предыдущего экрана (как реальный
 * клиент); ветки, недостижимые из UI (адрес вручную, устаревший экран),
 * нажимаются кодом со штампом текущего экрана.
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

const ANCHOR = new Date('2026-10-01T12:00:00.000Z');

const COURSE_ID = 'ca000001-0000-4000-8000-000000000001';
const MODULE_ID = 'a0a00001-0000-4000-8000-000000000001';
const PROJECT_INTRO = 'b0a00001-0000-4000-8000-000000000001';
const PROJECT_FINAL = 'b0a00002-0000-4000-8000-000000000002';
const LESSON_IO = 'c0a00001-0000-4000-8000-000000000001';
const LESSON_TYPES = 'c0a00002-0000-4000-8000-000000000002';
const LESSON_FINAL = 'c0a00003-0000-4000-8000-000000000003';
const STEP_SETUP = 'd0a00001-0000-4000-8000-000000000001';
const STEP_VARS = 'd0a00002-0000-4000-8000-000000000002';
const STEP_TYPES = 'd0a00003-0000-4000-8000-000000000003';
const STEP_FINAL = 'd0a00004-0000-4000-8000-000000000004';

const STREAM_ID = 'e0a00001-0000-4000-8000-000000000001';
const STREAM_EMPTY_ID = 'e0a00002-0000-4000-8000-000000000002';
const STREAM_GROUP_ID = '-1007777777777';
/** Поток, которого нет в мире — «чужой» адрес в callback. */
const FOREIGN_STREAM_ID = 'e0a0000f-0000-4000-8000-00000000000f';

/** Идентификатор записи студента: мир строит uuid из ключа. */
const studentId = (key: string): string => deterministicUuid(`student:${key}`);

const MENTOR_TG = 1004;
const TG = {
  noRecord: 1100,
  continueStudy: 1101,
  lesson: 1102,
  project: 1103,
  longBody: 1104,
  stream: 1105,
  finished: 1106,
  allDone: 1107,
  view: 1108,
  leave: 1109,
  drop: 1110,
  noSnapshot: 1111,
  mentor: MENTOR_TG,
};

/** Длинное тело шага — больше предела карточки (3200 символов). */
const LONG_BODY = 'Длинный текст шага для проверки усечения карточки. '.repeat(
  250,
);

function learner(key: string, name: string, telegramId: number): PersonDef {
  return { key, name, telegramId, roles: [Role.GUEST], registeredAt: 'T-90d' };
}

function completed(
  stepKey: string,
  issuedAt = 'T-9d',
  completedAt = 'T-8d',
): StudentStepDef {
  return { stepKey, status: 'completed', issuedAt, completedAt };
}

function issued(stepKey: string, issuedAt = 'T-7d'): StudentStepDef {
  return { stepKey, status: 'issued', issuedAt };
}

function learnerRecord(
  key: string,
  personKey: string,
  currentStepKey: string,
  steps: StudentStepDef[],
  status: StudentDef['status'] = 'active',
): StudentDef {
  return {
    key,
    personKey,
    streamKey: 'stream-study',
    enrolledAt: 'T-10d',
    status,
    currentStepKey,
    steps,
  };
}

/** Мир «Моя учёба»: один поток с программой из двух проектов и 12 студентов. */
const STUDY_WORLD: WorldDefinition = {
  name: 'learning-study',
  description: 'Мир «Моя учёба»: два проекта, уроки и шаги под сценарии P3',
  anchorDate: ANCHOR,
  persons: [
    {
      key: 'dev',
      name: 'Ментор',
      telegramId: MENTOR_TG,
      roles: [Role.MENTOR, Role.AUTHOR],
      registeredAt: 'T-90d',
    },
    learner('norecord', 'Без записи', TG.noRecord),
    learner('stud-continue', 'Начинающий', TG.continueStudy),
    learner('stud-lesson', 'Завершает урок', TG.lesson),
    learner('stud-project', 'Завершает проект', TG.project),
    learner('stud-long', 'Длинный шаг', TG.longBody),
    learner('stud-stream', 'Завершает поток', TG.stream),
    learner('stud-finished', 'Завершивший', TG.finished),
    learner('stud-alldone', 'Всё пройдено', TG.allDone),
    learner('stud-view', 'Смотрит шаг', TG.view),
    learner('stud-leave', 'Остаётся', TG.leave),
    learner('stud-drop', 'Уходит', TG.drop),
    learner('stud-nosnap', 'Поток без снапшота', TG.noSnapshot),
  ],
  courses: [
    {
      key: 'course-study',
      uuid: COURSE_ID,
      title: 'Курс «Моя учёба»',
      description: 'Курс для e2e сценариев раздела learning.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-study',
          uuid: MODULE_ID,
          title: 'Модуль «Моя учёба»',
          description: 'Модуль с двумя проектами и четырьмя шагами.',
          projects: [
            {
              key: 'proj-intro',
              uuid: PROJECT_INTRO,
              title: 'Введение',
              lessons: [
                {
                  key: 'less-io',
                  uuid: LESSON_IO,
                  title: 'Ввод и вывод',
                  steps: [
                    {
                      key: 'step-setup',
                      uuid: STEP_SETUP,
                      description: 'Настройка окружения',
                      content: 'Короткое тело шага настройки.',
                    } satisfies StepDef,
                    {
                      key: 'step-vars',
                      uuid: STEP_VARS,
                      description: 'Переменные и типы',
                      content: 'Тело шага про переменные.',
                    } satisfies StepDef,
                  ],
                },
                {
                  key: 'less-types',
                  uuid: LESSON_TYPES,
                  title: 'Типы данных',
                  steps: [
                    {
                      key: 'step-types',
                      uuid: STEP_TYPES,
                      description: 'Примитивные типы',
                      content: LONG_BODY,
                    } satisfies StepDef,
                  ],
                },
              ],
            },
            {
              key: 'proj-final',
              uuid: PROJECT_FINAL,
              title: 'Итоговый проект',
              lessons: [
                {
                  key: 'less-final',
                  uuid: LESSON_FINAL,
                  title: 'Сдача проекта',
                  steps: [
                    {
                      key: 'step-final',
                      uuid: STEP_FINAL,
                      description: 'Сдать проект',
                      content: 'Тело финального шага.',
                    } satisfies StepDef,
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  streams: [
    {
      key: 'stream-study',
      uuid: STREAM_ID,
      title: 'JS Core — учебный поток',
      description: 'Основной поток сценариев «Моя учёба».',
      courseKey: 'course-study',
      moduleKey: 'mod-study',
      mentorKey: 'dev',
      status: 'active',
      startedAt: 'T-10d',
      telegramGroupId: STREAM_GROUP_ID,
    },
    {
      key: 'stream-empty',
      uuid: STREAM_EMPTY_ID,
      title: 'JS Core — поток без программы',
      description: 'Поток с пустым снимком контента.',
      courseKey: 'course-study',
      moduleKey: 'mod-study',
      mentorKey: 'dev',
      status: 'active',
      startedAt: 'T-10d',
      contentSnapshot: [],
    },
  ],
  students: [
    learnerRecord('stud-continue', 'stud-continue', 'step-setup', [
      issued('step-setup'),
    ]),
    learnerRecord('stud-lesson', 'stud-lesson', 'step-vars', [
      completed('step-setup'),
      issued('step-vars'),
    ]),
    learnerRecord('stud-project', 'stud-project', 'step-types', [
      completed('step-setup'),
      completed('step-vars'),
      issued('step-types'),
    ]),
    learnerRecord('stud-long', 'stud-long', 'step-types', [
      completed('step-setup'),
      completed('step-vars'),
      issued('step-types'),
    ]),
    learnerRecord('stud-stream', 'stud-stream', 'step-final', [
      completed('step-setup'),
      completed('step-vars'),
      completed('step-types'),
      issued('step-final'),
    ]),
    learnerRecord(
      'stud-finished',
      'stud-finished',
      'step-final',
      [],
      'advanced',
    ),
    learnerRecord('stud-alldone', 'stud-alldone', 'step-final', [
      completed('step-setup'),
      completed('step-vars'),
      completed('step-types'),
      completed('step-final'),
    ]),
    learnerRecord('stud-view', 'stud-view', 'step-vars', [
      completed('step-setup'),
      issued('step-vars'),
    ]),
    learnerRecord('stud-leave', 'stud-leave', 'step-setup', [
      issued('step-setup'),
    ]),
    learnerRecord('stud-drop', 'stud-drop', 'step-setup', [
      issued('step-setup'),
    ]),
    {
      key: 'stud-nosnap',
      personKey: 'stud-nosnap',
      streamKey: 'stream-empty',
      enrolledAt: 'T-10d',
      status: 'active',
      steps: [],
    },
  ],
};

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  mentor: U7BotActor;
}

async function createStand(): Promise<Stand> {
  const app = await createTestApp('learning-study-e2e', STUDY_WORLD);
  const transport = createTestBotTransport(app, [
    new AppController(SCHOOL_GROUP_URL),
    new LearningController(),
    new StreamsController(),
  ]);
  const mentor = await app.userByTelegramId(MENTOR_TG);
  return { app, transport, mentor };
}

describe('E2E: «Моя учёба» — хаб, шаги, программа, прогресс, самовыход', () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await createStand();
  });

  beforeEach(() => {
    stand.transport.reset();
  });

  afterAll(async () => {
    await stand.app.cleanup();
  });

  // ── Хелперы ──

  const textOf = (response: DialogResponse): string =>
    String(response.screen?.text ?? '');

  const notifyOf = (response: DialogResponse): string =>
    String(response.notify?.text ?? '');

  /** /start → «🎓 Моя учёба»: экран хаба. */
  async function openHub(tgId: number): Promise<DialogResponse> {
    await stand.transport.handleStart(stand.transport.makeBotContext(tgId));
    return stand.transport.press(tgId, 'Моя учёба');
  }

  /**
   * Хаб кодом со штампом: у завершившего студента живой записи нет, и
   * пункта «🎓 Моя учёба» в главном меню не появляется.
   */
  async function openHubViaCode(tgId: number): Promise<DialogResponse> {
    await stand.transport.handleStart(stand.transport.makeBotContext(tgId));
    return stand.transport.pressRaw(tgId, 'learning:hub:my-study');
  }

  /** Хаб → «Продолжить/Начать учёбу»: экран текущего шага. */
  async function openCurrentStep(tgId: number): Promise<DialogResponse> {
    await openHub(tgId);
    return stand.transport.press(tgId, 'учёбу');
  }

  /** Запись студента после сценария (чтение через UC, вызывающий — ментор). */
  async function studentRecord(studentId: string) {
    return expectOk(
      await stand.app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId }),
        stand.mentor,
        testTrace(),
      ),
    ).student;
  }

  async function waitFor<T>(
    what: string,
    probe: () => T | undefined,
    timeoutMs = 3000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = probe();
      if (found !== undefined) return found;
      if (Date.now() > deadline) throw new Error(`Таймаут ожидания: ${what}`);
      await Bun.sleep(25);
    }
  }

  // ── Хаб и меню ──

  test('P3-02: главное меню человека без живой записи студента — кнопки «🎓 Моя учёба» нет', async () => {
    const noRecord = await stand.app.userByTelegramId(TG.noRecord);
    const menu = await stand.transport.collectMainMenu(noRecord);

    expect(menu.some((item) => item.text.includes('Моя учёба'))).toBe(false);
  });

  test('P3-04: хаб при завершённом шаге — первая кнопка «▶️ Продолжить учёбу»', async () => {
    const hub = await openHub(TG.lesson);

    expect(textOf(hub)).toContain('Моя учёба');
    expect(Screen.of(hub).texts()[0]).toBe('▶️ Продолжить учёбу');
    expect(Screen.of(hub).texts()).toContain('📖 Программа модуля');
    expect(Screen.of(hub).texts()).toContain('📊 Мой прогресс');
  });

  test('P3-05: хаб завершившего студента — нет «учёбы» и программы, остаются прогресс, уход и меню', async () => {
    const hub = await openHubViaCode(TG.finished);
    const buttons = Screen.of(hub).texts();

    expect(textOf(hub)).toContain('Моя учёба');
    expect(buttons.some((t) => t.includes('Продолжить'))).toBe(false);
    expect(buttons.some((t) => t.includes('Начать учёбу'))).toBe(false);
    expect(buttons.some((t) => t.includes('Программа модуля'))).toBe(false);
    expect(buttons).toContain('📊 Мой прогресс');
    expect(buttons).toContain('🚪 Покинуть учёбу');
    expect(buttons).toContain('↩️ Главное меню');
  });

  test('P3-06: хаб без записи студента — экран «Вы не записаны ни на один поток»', async () => {
    await stand.transport.handleStart(
      stand.transport.makeBotContext(TG.noRecord),
    );
    const response = await stand.transport.pressRaw(
      TG.noRecord,
      'learning:hub:my-study',
    );

    expect(textOf(response)).toContain('Вы не записаны ни на один поток');
  });

  // ── Прохождение шагов ──

  test('P3-08: «Продолжить учёбу» у завершившего студента — «Поздравляю! Вы завершили обучение»', async () => {
    const tgId = TG.finished;
    await openHubViaCode(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      'learning:step-view:my-study:continue',
    );

    expect(textOf(response)).toContain('Вы завершили обучение в потоке');
    expect(Screen.of(response).texts()).toEqual([]);
  });

  test('P3-09: все шаги пройдены, итог не поставлен — экран «Поток полностью завершён»', async () => {
    const tgId = TG.allDone;
    await openHub(tgId);
    const before = stand.transport.api.sentMessages.length;

    const response = await stand.transport.press(tgId, 'учёбу');

    expect(textOf(response)).toContain('Поток полностью завершён');
    expect(textOf(response)).toContain(
      'Поздравляю с успешным окончанием обучения',
    );
    expect(Screen.of(response).texts()).toContain('↩️ Главное меню');
    // Экран — новое сообщение, а не правка карточки шага
    expect(stand.transport.api.sentMessages.length).toBeGreaterThan(before);
  });

  test('P3-11: «Выполнено» на последнем шаге урока — экран «Урок завершён» и переход к следующему', async () => {
    const tgId = TG.lesson;
    const step = await openCurrentStep(tgId);
    expect(textOf(step)).toContain('Шаг 2');

    const transition = await stand.transport.press(tgId, 'Выполнено');
    const text = textOf(transition);

    expect(text).toContain('Урок «Ввод и вывод» завершён');
    expect(text).toContain('Прогресс по модулю');
    expect(text).toContain('Прогресс по проекту');
    expect(Screen.of(transition).texts()).toContain('▶️ Начать следующий урок');
    expect(Screen.of(transition).texts()).toContain('↩️ Главное меню');
  });

  test('P3-12: «Выполнено» на последнем шаге проекта — экран «Проект завершён»', async () => {
    const tgId = TG.project;
    await openCurrentStep(tgId);

    const transition = await stand.transport.press(tgId, 'Выполнено');
    const text = textOf(transition);

    expect(text).toContain('Проект «Введение» завершён');
    expect(text).toContain('Прогресс по модулю');
    expect(Screen.of(transition).texts()).toContain(
      '▶️ Начать следующий проект',
    );
    expect(Screen.of(transition).texts()).toContain('↩️ Главное меню');
  });

  test('P3-13: «Выполнено» на последнем шаге программы — экран «Поток полностью завершён»', async () => {
    const tgId = TG.stream;
    await openCurrentStep(tgId);

    const transition = await stand.transport.press(tgId, 'Выполнено');

    expect(textOf(transition)).toContain('Поток полностью завершён');
    expect(Screen.of(transition).texts()).toContain('↩️ Главное меню');

    const record = await studentRecord(studentId('stud-stream'));
    expect(record.status).toBe('active');
  });

  test('P3-14: повторный «Выполнено» по пройденному шагу — актуальный шаг без ошибки', async () => {
    const tgId = TG.view;
    await openHub(tgId);

    const first = await stand.transport.pressRaw(
      tgId,
      `learning:step-view:complete:${STREAM_ID}:${STEP_SETUP}`,
    );
    expect(textOf(first)).toContain('Шаг 2');

    const repeat = await stand.transport.pressRaw(
      tgId,
      `learning:step-view:complete:${STREAM_ID}:${STEP_SETUP}`,
    );
    expect(textOf(repeat)).toContain('Шаг 2');
    expect(textOf(repeat)).toContain('Переменные и типы');
  });

  test('P3-15: «Выполнено» с чужим streamId — экран о несоответствии потока', async () => {
    const tgId = TG.continueStudy;
    await openHub(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      `learning:step-view:complete:${FOREIGN_STREAM_ID}:${STEP_SETUP}`,
    );

    expect(textOf(response)).toContain(
      'поток не соответствует вашему текущему обучению',
    );
  });

  test('P3-16: «Выполнено» с битым callback (нет шага) — «Неизвестная команда»', async () => {
    const tgId = TG.continueStudy;
    await openHub(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      'learning:step-view:complete',
    );

    expect(textOf(response)).toContain('Неизвестная команда');
  });

  // ── Программа модуля (nav-tree) ──

  test('P3-20: карточка пройденного шага — хлебные крошки, статус, тело и навигация без «Выполнено»', async () => {
    const tgId = TG.view;
    await openHub(tgId);

    const card = await stand.transport.pressRaw(
      tgId,
      `learning:nav-tree:step:${STEP_SETUP}`,
    );
    const text = textOf(card);
    const buttons = Screen.of(card).texts();

    expect(text).toContain('Программа модуля');
    expect(text).toContain('Введение');
    expect(text).toContain('Пройден');
    expect(text).toContain('Короткое тело шага настройки');
    expect(buttons).toContain('След. ▶️');
    expect(buttons).toContain('⬅️ Назад к уроку');
    expect(buttons.some((t) => t.includes('Выполнено'))).toBe(false);
  });

  test('P3-21: тело шага длиннее 3200 символов — усечено с пометкой о платформе', async () => {
    const tgId = TG.longBody;
    await openHub(tgId);

    const card = await stand.transport.pressRaw(
      tgId,
      `learning:nav-tree:step:${STEP_TYPES}`,
    );
    const text = textOf(card);

    expect(text).toContain('Контент сокращён');
    expect(text).toContain('полный текст доступен на платформе');
    expect(text.length).toBeLessThan(LONG_BODY.length);
  });

  test('P3-22: адрес закрытого шага вручную — «Шаг или уровень не найден или недоступен»', async () => {
    const tgId = TG.continueStudy;
    await openHub(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      `learning:nav-tree:step:${STEP_VARS}`,
    );

    expect(textOf(response)).toContain(
      'Шаг или уровень не найден или недоступен',
    );
  });

  test('P3-23: адрес программы не распознан — «Неизвестная команда»', async () => {
    const tgId = TG.continueStudy;
    await openHub(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      'learning:nav-tree:unknown:xyz',
    );

    expect(textOf(response)).toContain('Неизвестная команда');
  });

  test('P3-24: программа модуля без записи студента — «Вы не записаны ни на один поток»', async () => {
    await stand.transport.handleStart(
      stand.transport.makeBotContext(TG.noRecord),
    );

    const response = await stand.transport.pressRaw(
      TG.noRecord,
      'learning:nav-tree:root',
    );

    expect(textOf(response)).toContain('Вы не записаны ни на один поток');
  });

  // ── Прогресс (progress) ──

  test('P3-26: прогресс с чужим streamId — «Этот прогресс не соответствует вашему текущему потоку»', async () => {
    const tgId = TG.continueStudy;
    await openHub(tgId);

    const response = await stand.transport.pressRaw(
      tgId,
      `learning:progress:progress:${FOREIGN_STREAM_ID}`,
    );

    expect(textOf(response)).toContain(
      'не соответствует вашему текущему потоку',
    );
  });

  // P3-27: ветка «программы нет» v0.2.6 убрана намеренно — снимок программы
  // в контракте есть всегда, пустой даёт нулевой прогресс (regressions.md).
  test('P3-27: «Мой прогресс» у потока с пустой программой — нулевой прогресс', async () => {
    const tgId = TG.noSnapshot;
    await openHub(tgId);

    const response = await stand.transport.press(tgId, 'Мой прогресс');
    const text = textOf(response);

    expect(text).toContain('Мой прогресс');
    expect(text).toContain('Пройдено шагов');
    expect(text).toContain('0%');
    expect(text).not.toContain('Программа потока не найдена');
  });

  test('P3-28: прогресс без записи студента — «Вы не записаны ни на один поток»', async () => {
    await stand.transport.handleStart(
      stand.transport.makeBotContext(TG.noRecord),
    );

    const response = await stand.transport.pressRaw(
      TG.noRecord,
      `learning:progress:progress:${STREAM_ID}`,
    );

    expect(textOf(response)).toContain('Вы не записаны ни на один поток');
  });

  // ── Самовыход из учёбы (FR-4) ──

  test('P3-29: хаб → «Покинуть учёбу» — подтверждение с «Да, покинуть» и «Остаться»', async () => {
    const tgId = TG.leave;
    await openHub(tgId);

    const confirm = await stand.transport.press(tgId, 'Покинуть учёбу');

    expect(textOf(confirm)).toContain('Покинуть учёбу?');
    expect(textOf(confirm)).toContain('Прогресс сохранится');
    expect(Screen.of(confirm).texts()).toEqual([
      '🚪 Да, покинуть',
      '❌ Остаться',
    ]);
  });

  test('P3-30: подтверждение → «Остаться» — возврат в хаб', async () => {
    const tgId = TG.leave;
    await openHub(tgId);
    await stand.transport.press(tgId, 'Покинуть учёбу');

    const back = await stand.transport.press(tgId, 'Остаться');

    expect(textOf(back)).toContain('Моя учёба');
    expect(Screen.of(back).texts()).toContain('▶️ Начать учёбу');
  });

  test('P3-31: «Да, покинуть» — экран ухода, abandoned, кик из группы и уведомление ментору', async () => {
    const tgId = TG.drop;
    await openHub(tgId);
    await stand.transport.press(tgId, 'Покинуть учёбу');

    const left = await stand.transport.press(tgId, 'Да, покинуть');

    expect(textOf(left)).toContain('Ты покинул учёбу');
    expect(Screen.of(left).texts()).toContain('⬅️ В меню');

    const record = await studentRecord(studentId('stud-drop'));
    expect(record.status).toBe('abandoned');

    const kick = await waitFor('мягкий кик из группы потока', () =>
      stand.transport.api.kickedMembers.find((k) => k.telegramId === TG.drop),
    );
    expect(String(kick.chatId)).toBe(STREAM_GROUP_ID);
    expect(kick.unbanned).toBe(true);

    const notice = await waitFor('уведомление ментору об уходе', () =>
      stand.transport.api.sentMessages.find(
        (m) => m.telegramId === MENTOR_TG && m.text.includes('покинул учёбу'),
      ),
    );
    expect(notice.text).toContain('по собственному желанию');
  });

  test('P3-34: уход студента с итоговым статусом — отказ «Нельзя снять студента с учёбы»', async () => {
    const tgId = TG.finished;
    await openHubViaCode(tgId);
    await stand.transport.press(tgId, 'Покинуть учёбу');

    const refused = await stand.transport.press(tgId, 'Да, покинуть');

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain('Нельзя снять студента с учёбы');
    expect(textOf(refused)).not.toContain('Ты покинул учёбу');
  });
});
