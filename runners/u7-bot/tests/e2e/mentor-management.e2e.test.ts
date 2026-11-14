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
import { LearningController } from '@u7-scl/bot/learning/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import { Role } from '@u7-scl/domain/user/testing';
import { Screen } from '@u7-scl/test-helpers/screen';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  screensNewFirst,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import type {
  PersonDef,
  StreamDef,
  StudentDef,
  WorldDefinition,
} from '../worlds';
import { deterministicUuid } from '../worlds/uuid';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** Последний отправленный экран пользователя (send+edit по messageId). */
function lastScreen(transport: TestBotTransport, tgId: number) {
  const [screen] = screensNewFirst(transport, tgId);
  if (!screen) throw new Error(`Нет экранов у пользователя ${tgId}`);
  return screen;
}

/** Отштампованный код кнопки по предикату кода (для мостов controller:…). */
function pressedCodeBy(
  transport: TestBotTransport,
  tgId: number,
  predicate: (code: string) => boolean,
): string {
  for (const screen of screensNewFirst(transport, tgId)) {
    const btn = screen.keyboard?.rows.flat().find((b) => predicate(b.code));
    if (btn) return btn.code;
  }
  throw new Error(`Кнопка по предикату не найдена на экранах ${tgId}`);
}

/**
 * E2E: Ментор — управление студентами через «Инструменты ментора».
 *
 * Путь: главное меню → «🛠️ Инструменты ментора» → «📋 Мои потоки»
 *       → карточка потока → «👥 Студенты» → действия со студентами.
 *
 * Контракт «Диалог и Экран»: коды кнопок берутся отштампованными
 * из Api-записи предыдущего экрана (:~seq36 — как реальный клиент),
 * содержимое ответа ассертится по DialogResponse (notify и screen
 * разделены: реплика результата — notify, целевой экран — screen).
 */
describe('E2E: Ментор — управление студентами', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let mentor: U7BotActor;
  let tgId: number;

  beforeAll(async () => {
    app = await createTestApp('e2e-mentor');
    const streamController = new StreamsController();
    const courseController = new CoursesController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    const learningController = new LearningController();
    const mentorController = new MentorController();
    transport = createTestBotTransport(app, [
      appController,
      streamController,
      courseController,
      learningController,
      mentorController,
    ]);
    mentor = await app.userByTelegramId(1004);
    tgId = mentor.user.view().telegramId;
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Меню → подменю → мои потоки → активный поток → «Студенты». */
  async function openStudents() {
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.press(tgId, 'Инструменты ментора');
    await transport.press(tgId, 'Мои потоки');
    await transport.press(tgId, '🔵');
    await transport.press(tgId, 'Студенты');
  }

  // ── Список студентов через менторскую карточку ──

  test('ментор → мои потоки → «👥 Студенты» → список с менторскими кнопками ⛔✅', async () => {
    await transport.handleStart(transport.makeBotContext(tgId));

    // 2. Подменю: «📋 Мои потоки»
    await transport.press(tgId, 'Инструменты ментора');
    await transport.press(tgId, 'Мои потоки');

    // 3. Список моих потоков → активный (🔵)
    await transport.press(tgId, '🔵');

    // 4. Менторская карточка потока: «👥 Студенты» + lifecycle «Завершить»
    const card = lastScreen(transport, tgId);
    const cardBtns = card.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(cardBtns.some((t) => t.includes('Студенты'))).toBe(true);
    expect(cardBtns.some((t) => t.includes('Завершить'))).toBe(true);

    // 5. Нажимаем «👥 Студенты» → менторский список (monitor)
    const studentsResp = await transport.press(tgId, 'Студенты');
    expect(String(studentsResp.screen?.text)).not.toContain('Неизвестная');
    expect(String(studentsResp.screen?.text)).toContain('Студенты потока');

    // 6. Кнопки в списке студентов
    const allTexts =
      lastScreen(transport, tgId)
        .keyboard?.rows.flat()
        .map((b) => b) ?? [];

    // Менторские кнопки ⛔✅ для активных студентов
    expect(allTexts.map((b) => b.text)).toContain('⛔');
    expect(allTexts.map((b) => b.text)).toContain('✅');

    // Кнопка ⛔ ведёт в monitor (MentorController)
    const abandon = allTexts.find((b) => b.text === '⛔')!;
    expect(abandon.code).toStartWith('mentor:monitor:mark-abandoned:');

    // Кнопка ✅ ведёт в monitor (MentorController)
    const complete = allTexts.find((b) => b.text === '✅')!;
    expect(complete.code).toStartWith('mentor:monitor:complete:');

    // Кнопка-имя студента ведёт в monitor:detail
    const detailCodes = allTexts
      .map((b) => b.code)
      .filter((c) => c.includes('monitor:detail:'));
    expect(detailCodes.length).toBeGreaterThan(0);
  });

  // ── Диалог mark-abandoned ──

  test('ментор: ⛔ mark-abandoned → подтверждение → отмена → возврат к карточке', async () => {
    await openStudents();

    // 2. ⛔ на первом студенте → confirm-диалог
    const confirmResp = await transport.press(tgId, '⛔');

    // Диалог подтверждения с репликой-экраном
    expect(String(confirmResp.screen?.text)).toContain('Снять студента');
    expect(String(confirmResp.screen?.text)).not.toContain('Неизвестная');

    // Кнопки подтверждения/отмены
    const confirmBtns =
      confirmResp.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    expect(confirmBtns.some((t) => t.includes('Да'))).toBe(true);
    expect(confirmBtns.some((t) => t.includes('Отмена'))).toBe(true);

    // 3. Отмена → возврат к детальной карточке студента (monitor:detail)
    const cancelResp = await transport.press(tgId, 'Отмена');
    expect(String(cancelResp.screen?.text)).not.toContain('Неизвестная');
    expect(String(cancelResp.screen?.text)).toContain('Прогресс студента');
  });

  test('ментор: ⛔ mark-abandoned → подтвердить → студент отчислен', async () => {
    await openStudents();

    // 2. ⛔ на первом студенте → confirm-диалог → «⚠️ Да, неактивен»:
    //    реплика результата + delegate к списку студентов
    await transport.press(tgId, '⛔');
    const resultResp = await transport.press(tgId, 'Да, неактивен');
    expect(resultResp.notify?.text).toContain('снят с учёбы');
    expect(String(resultResp.screen?.text)).toContain('Студенты потока');
  });

  test('ментор: ✅ complete → выбрать «окончил» → подтвердить → студент завершён', async () => {
    await openStudents();

    // Дефолт — только активные; показываем всех (FR-8)
    await transport.press(tgId, 'Показать выбывших');

    // 2. 🔄 у перезавершаемого студента → выбор исхода
    const choiceResp = await transport.press(tgId, '🔄');
    expect(String(choiceResp.screen?.text)).toContain('Выберите исход');

    // 3. Выбираем «✅ окончил» (словарь меток stream) → confirm-диалог
    const confirmResp = await transport.press(tgId, '✅ окончил');
    expect(String(confirmResp.screen?.text)).toContain('окончил');

    // 4. Подтверждаем: реплика + delegate к списку
    const resultResp = await transport.press(tgId, 'Завершить');
    expect(resultResp.notify?.text).toContain('завершён');
    expect(String(resultResp.screen?.text)).toContain('Студенты потока');
  });

  test('ментор: карточка студента (detail) — видна с «Назад к списку»', async () => {
    await openStudents();

    // Карточка advanced-студента — только в режиме «все» (FR-8)
    await transport.press(tgId, 'Показать выбывших');

    // 2. Кликаем на кнопку-имя студента (monitor:detail)
    const detailResp = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCodeBy(transport, tgId, (c) =>
          c.includes('monitor:detail'),
        ),
      }),
    );

    const text = String(detailResp.screen?.text);
    expect(text).toContain('Прогресс студента');
    expect(text).toContain('Усидчивость');
    expect(text).toContain('Активность');

    // Кнопка «Назад к списку»
    const backBtn = lastScreen(transport, tgId)
      .keyboard?.rows.flat()
      .find((b) => b.text.includes('Назад к списку'));
    expect(backBtn).toBeDefined();
  });

  // ── Создание потока (S09 wizard) ──

  describe('Создание потока (wizard)', () => {
    test('полный цикл: меню → wizard (все шаги) → поток создан', async () => {
      await transport.handleStart(transport.makeBotContext(tgId));

      // 1-2. Инструменты ментора → Создать поток (шаг 0: выбор модуля)
      await transport.press(tgId, 'Инструменты ментора');
      await transport.press(tgId, 'Создать поток');
      const step0 = lastScreen(transport, tgId);
      expect(String(step0.text)).toContain('Выберите модуль');
      expect(
        step0.keyboard?.rows
          .flat()
          .some((b) => b.text.includes('JavaScript Основы')),
      ).toBe(true);

      // Шаг 1: название
      await transport.press(tgId, 'JavaScript Основы');
      const step1 = lastScreen(transport, tgId);
      expect(String(step1.text)).toContain('название потока');

      // Принимаем название
      await transport.press(tgId, 'Принять');
      const step2 = lastScreen(transport, tgId);
      expect(String(step2.text)).toContain('описание потока');

      // Шаг 2: вводим описание вручную
      const step3 = await transport.handleMessage(
        transport.makeBotContext(tgId, { text: 'E2E Тестовый Поток' }),
      );
      expect(String(step3.screen?.text)).toContain('дату старта');

      // Шаг 3: вводим дату
      const step4 = await transport.handleMessage(
        transport.makeBotContext(tgId, { text: '2026-12-15' }),
      );
      expect(String(step4.screen?.text)).toContain('Цель');

      // Шаги 4-8: пропускаем все необязательные поля
      for (let i = 0; i < 5; i++) {
        await transport.press(tgId, 'Пропустить');
      }
      expect(String(lastScreen(transport, tgId).text)).toContain('Telegram');

      // Шаг 9: группа (ID) — пропускаем
      await transport.press(tgId, 'Пропустить');
      expect(String(lastScreen(transport, tgId).text)).toContain('инвайт');

      // Шаг 10: инвайт-ссылка — пропускаем
      await transport.press(tgId, 'Пропустить');
      expect(String(lastScreen(transport, tgId).text)).toContain(
        'кодовое слово',
      );

      // Шаг 11: кодовое слово — пропускаем → превью
      const previewResp = await transport.press(tgId, 'Пропустить');
      const preview = String(previewResp.screen?.text);
      expect(preview).toContain('Превью потока');
      expect(preview).toContain('JavaScript Основы');
      expect(preview).toContain('E2E Тестовый Поток');

      // Подтверждаем: поток создан, ввод освобождён
      const finalResp = await transport.press(tgId, 'Создать');
      expect(String(finalResp.screen?.text)).toContain('успешно создан');
      expect(finalResp.release).toBe(true);
    });

    test('отмена создания потока', async () => {
      await transport.handleStart(transport.makeBotContext(tgId));
      await transport.press(tgId, 'Инструменты ментора');
      await transport.press(tgId, 'Создать поток');
      const step0 = lastScreen(transport, tgId);
      expect(String(step0.text)).toContain('Выберите модуль');

      // Отменяем (/cancel — команда pipe: активная стори стопается)
      const cancelResp = await transport.handleCancel(
        transport.makeBotContext(tgId),
      );
      expect(cancelResp.notify?.text).toContain('отменено');
      expect(cancelResp.release).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Экранные ветки инструментов ментора (подменю, список потоков, программа,
// детали, wizard создания) — на производном мире со всеми статусами потоков.
// ═══════════════════════════════════════════════════════════════════════

const MGMT_ANCHOR = new Date('2026-10-01T12:00:00.000Z');

const MGMT_COURSE_ID = 'cb300001-0000-4000-8000-000000000001';
const MGMT_MODULE_ID = 'ab300001-0000-4000-8000-000000000001';
const MGMT_PROJECT_ID = 'bb300001-0000-4000-8000-000000000001';
const MGMT_LESSON_ID = 'cb300001-0000-4000-8000-000000000002';
const MGMT_STEP1_ID = 'db300001-0000-4000-8000-000000000001';
const MGMT_STEP2_ID = 'db300002-0000-4000-8000-000000000002';
const MGMT_UNKNOWN_STREAM = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const mgmtStreamId = (key: string): string =>
  deterministicUuid(`stream:${key}`);

const MGMT_TG = {
  mentor: 1004,
  otherMentor: 1009,
  mentorNoStreams: 1010,
  guest: 1201,
};

function mgmtMentor(key: string, name: string, telegramId: number): PersonDef {
  return {
    key,
    name,
    telegramId,
    roles: [Role.MENTOR, Role.AUTHOR],
    registeredAt: 'T-90d',
  };
}

const mgmtCourse = {
  key: 'course-mgmt',
  uuid: MGMT_COURSE_ID,
  title: 'Курс ментора',
  description: 'Курс для экранных ветвей инструментов ментора.',
  authorKey: 'dev',
  modules: [
    {
      key: 'mod-mgmt',
      uuid: MGMT_MODULE_ID,
      title: 'Модуль ментора',
      description: 'Модуль с одним проектом.',
      projects: [
        {
          key: 'proj-mgmt',
          uuid: MGMT_PROJECT_ID,
          title: 'Проект ментора',
          lessons: [
            {
              key: 'less-mgmt',
              uuid: MGMT_LESSON_ID,
              title: 'Урок ментора',
              steps: [
                {
                  key: 'step-one',
                  uuid: MGMT_STEP1_ID,
                  description: 'Первый шаг',
                  content: 'Тело первого шага.',
                },
                {
                  key: 'step-two',
                  uuid: MGMT_STEP2_ID,
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
};

/** Поток ментора `dev`; `foreign` — поток второго ментора. */
function mgmtStream(
  key: string,
  title: string,
  status: 'enrollment' | 'active' | 'completed' | 'archived',
  ownerKey = 'dev',
  extra: Partial<StreamDef> = {},
): StreamDef {
  return {
    key,
    uuid: mgmtStreamId(key),
    title,
    description: `Поток «${title}» для e2e экранов ментора.`,
    courseKey: 'course-mgmt',
    moduleKey: 'mod-mgmt',
    mentorKey: ownerKey,
    status,
    startedAt: 'T-20d',
    telegramGroupId: `-10099999999${key.length}`,
    ...extra,
  };
}

const MGMT_WORLD: WorldDefinition = {
  name: 'mentor-mgmt-screens',
  description: 'Потоки во всех статусах, чужой поток, поток без программы',
  anchorDate: MGMT_ANCHOR,
  persons: [
    mgmtMentor('dev', 'Ментор', MGMT_TG.mentor),
    mgmtMentor('mentor2', 'Второй ментор', MGMT_TG.otherMentor),
    mgmtMentor('mentor3', 'Ментор без потоков', MGMT_TG.mentorNoStreams),
    {
      key: 'guest',
      name: 'Гость',
      telegramId: MGMT_TG.guest,
      roles: [Role.GUEST],
      registeredAt: 'T-90d',
    },
  ],
  courses: [mgmtCourse],
  streams: [
    mgmtStream('stream-enroll', 'Поток набора', 'enrollment'),
    mgmtStream('stream-live', 'Поток в обучении', 'active'),
    mgmtStream('stream-done', 'Поток завершён', 'completed'),
    mgmtStream('stream-archived', 'Поток в архиве', 'archived'),
    mgmtStream(
      'stream-nosnapshot',
      'Поток без программы',
      'enrollment',
      'dev',
      {
        contentSnapshot: [],
      },
    ),
    mgmtStream('stream-empty', 'Поток без деталей', 'enrollment', 'dev', {
      goal: '',
      result: '',
    }),
    mgmtStream('stream-foreign', 'Чужой поток', 'enrollment', 'mentor2'),
  ],
  students: [
    {
      key: 'stud-live',
      uuid: deterministicUuid('student:stud-live'),
      personKey: 'guest',
      streamKey: 'stream-live',
      enrolledAt: 'T-19d',
      status: 'active',
      currentStepKey: 'step-one',
      steps: [{ stepKey: 'step-one', status: 'issued', issuedAt: 'T-18d' }],
    } satisfies StudentDef,
  ],
};

/** Мир без опубликованных модулей — шаг 0 wizard-а «Создать поток». */
const MGMT_NO_MODULES_WORLD: WorldDefinition = {
  ...MGMT_WORLD,
  name: 'mentor-mgmt-no-modules',
  description: 'Тот же мир без курсов: wizard не находит модулей',
  courses: [],
  streams: [],
  students: [],
};

describe('E2E: инструменты ментора — экранные ветки', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let emptyApp: TestApp;
  let emptyTransport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('mentor-mgmt-screens', MGMT_WORLD);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new StreamsController(),
      new CoursesController(),
      new LearningController(),
      new MentorController(),
    ]);
    emptyApp = await createTestApp(
      'mentor-mgmt-no-modules',
      MGMT_NO_MODULES_WORLD,
    );
    emptyTransport = createTestBotTransport(emptyApp, [
      new AppController(SCHOOL_GROUP_URL),
      new StreamsController(),
      new CoursesController(),
      new LearningController(),
      new MentorController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
    emptyTransport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
    await emptyApp.cleanup();
  });

  // ── Хелперы ──

  const textOf = (response: DialogResponse): string =>
    String(response.screen?.text ?? '');

  const notifyOf = (response: DialogResponse): string =>
    String(response.notify?.text ?? '');

  /** Крафтовый адрес с актуальным штампом свежего экрана. */
  async function craft(tgId: number, rawCode: string): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    return transport.pressRaw(tgId, rawCode);
  }

  /** /start → подменю → «Мои потоки». */
  async function openMyStreams(tgId: number): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.press(tgId, 'Инструменты ментора');
    return transport.press(tgId, 'Мои потоки');
  }

  // ── Доступ к подменю ──

  test('P4-02: у гостя в главном меню нет кнопки «Инструменты ментора»', async () => {
    const welcome = await transport.handleStart(
      transport.makeBotContext(MGMT_TG.guest),
    );

    expect(
      Screen.of(welcome)
        .texts()
        .some((t) => t.includes('Инструменты ментора')),
    ).toBe(false);
    expect(Screen.of(welcome).texts()).toContain('📖 Курсы');
  });

  test('P4-03: гость по прямому адресу подменю — экран «нет доступа»', async () => {
    const response = await craft(MGMT_TG.guest, 'mentor:submenu:start');

    expect(textOf(response)).toContain(
      'У вас нет доступа к инструментам ментора',
    );
  });

  // ── Список потоков ──

  test('P4-05: переключатели завершённых и архивных потоков', async () => {
    const fresh = await openMyStreams(MGMT_TG.mentor);
    expect(Screen.of(fresh).texts()).toContain('🟢 Вкл. завершённые');
    expect(Screen.of(fresh).texts()).toContain('⚫ Вкл. архивированные');
    expect(
      Screen.of(fresh)
        .texts()
        .some((t) => t.includes('Поток набора')),
    ).toBe(true);
    expect(
      Screen.of(fresh)
        .texts()
        .some((t) => t.includes('Поток в обучении')),
    ).toBe(true);
    expect(
      Screen.of(fresh)
        .texts()
        .some((t) => t.includes('Поток завершён')),
    ).toBe(false);

    const withCompleted = await transport.press(
      MGMT_TG.mentor,
      'Вкл. завершённые',
    );
    expect(
      Screen.of(withCompleted)
        .texts()
        .some((t) => t.includes('Поток завершён')),
    ).toBe(true);
    expect(
      Screen.of(withCompleted)
        .texts()
        .some((t) => t.includes('Поток в архиве')),
    ).toBe(false);
    expect(Screen.of(withCompleted).texts()).toContain(
      '⚫ Вкл. архивированные',
    );
    expect(Screen.of(withCompleted).texts()).not.toContain(
      '🟢 Вкл. завершённые',
    );

    const all = await transport.press(MGMT_TG.mentor, 'Вкл. архивированные');
    expect(
      Screen.of(all)
        .texts()
        .some((t) => t.includes('Поток завершён')),
    ).toBe(true);
    expect(
      Screen.of(all)
        .texts()
        .some((t) => t.includes('Поток в архиве')),
    ).toBe(true);
    expect(Screen.of(all).texts()).not.toContain('⚫ Вкл. архивированные');
  });

  test('P4-06: у ментора нет потоков — «У вас пока нет потоков»', async () => {
    const response = await openMyStreams(MGMT_TG.mentorNoStreams);

    expect(textOf(response)).toContain('У вас пока нет потоков');
    expect(Screen.of(response).texts()).toContain('🔙 Назад');
  });

  test('P4-07: сбой чтения потоков — реплика warn, а не экран списка', async () => {
    // Бот читает <dbDir>/streams/streams.json (в фикстурах есть и legacy-копия)
    const file = `${app.fixtures.dbDir}/streams/streams.json`;
    const original = await Bun.file(file).text();
    try {
      await Bun.write(file, '{{{ not json');

      await transport.handleStart(transport.makeBotContext(MGMT_TG.mentor));
      await transport.press(MGMT_TG.mentor, 'Инструменты ментора');
      const response = await transport.press(MGMT_TG.mentor, 'Мои потоки');

      expect(response.notify?.kind).toBe('warn');
      expect(notifyOf(response)).toContain('Произошла ошибка');
    } finally {
      await Bun.write(file, original);
    }
  });

  // ── Программа модуля ──

  test('P4-17: программа модуля — проект → урок → шаг с телом', async () => {
    await openMyStreams(MGMT_TG.mentor);
    await transport.press(MGMT_TG.mentor, 'Поток в обучении');
    const program = await transport.press(MGMT_TG.mentor, 'Программа модуля');

    expect(textOf(program)).toContain('Программа модуля');
    expect(textOf(program)).toContain('Проект ментора');

    const project = await transport.press(MGMT_TG.mentor, 'Проект ментора');
    expect(textOf(project)).toContain('Уроки проекта');

    const lesson = await transport.press(MGMT_TG.mentor, 'Урок ментора');
    expect(textOf(lesson)).toContain('Шаги урока');

    const step = await transport.press(MGMT_TG.mentor, 'Первый шаг');
    expect(textOf(step)).toContain('Тело первого шага');
  });

  test('P4-18: поток без снимка программы — «Программа пока не загружена»', async () => {
    await openMyStreams(MGMT_TG.mentor);
    await transport.press(MGMT_TG.mentor, 'Поток без программы');

    const response = await transport.press(MGMT_TG.mentor, 'Программа модуля');

    expect(textOf(response)).toContain('Программа пока не загружена');
    expect(Screen.of(response).texts()).toContain('⬅️ Назад к потоку');
  });

  test('P4-19: программа чужого потока у ментора — «нет прав»', async () => {
    const response = await craft(
      MGMT_TG.mentor,
      `mentor:view-stream-mentor:program:${mgmtStreamId('stream-foreign')}`,
    );

    expect(textOf(response)).toContain(
      'У вас нет прав для управления этим потоком',
    );
  });

  test('P4-20: поток не найден в программе — реплика warn «Поток не найден»', async () => {
    const response = await craft(
      MGMT_TG.mentor,
      `mentor:view-stream-mentor:program:${MGMT_UNKNOWN_STREAM}`,
    );

    expect(response.notify?.kind).toBe('warn');
    expect(notifyOf(response)).toContain('Поток не найден');
  });

  // ── Детали потока ──

  test('P4-21: «Детали» — заполненные поля и заглушка для пустых', async () => {
    await openMyStreams(MGMT_TG.mentor);
    await transport.press(MGMT_TG.mentor, 'Поток в обучении');
    const filled = await transport.press(MGMT_TG.mentor, 'Детали');

    expect(textOf(filled)).toContain('Детали: Поток в обучении');
    expect(textOf(filled)).toContain('🎯 Цель');
    expect(textOf(filled)).toContain('🏆 Результат');
    expect(textOf(filled)).not.toContain('Расширенная информация');

    await openMyStreams(MGMT_TG.mentor);
    await transport.press(MGMT_TG.mentor, 'Поток без деталей');
    const empty = await transport.press(MGMT_TG.mentor, 'Детали');

    expect(textOf(empty)).toContain('Расширенная информация пока не добавлена');
    expect(
      Screen.of(empty)
        .texts()
        .some((t) => t.includes('Назад')),
    ).toBe(true);
  });

  // ── Wizard создания потока: отказы ──

  test('P4-38: wizard без опубликованных модулей — «Нет доступных модулей»', async () => {
    await emptyTransport.handleStart(
      emptyTransport.makeBotContext(MGMT_TG.mentor),
    );
    await emptyTransport.press(MGMT_TG.mentor, 'Инструменты ментора');
    const response = await emptyTransport.press(
      MGMT_TG.mentor,
      'Создать поток',
    );

    expect(String(response.screen?.text)).toContain('Нет доступных модулей');
    expect(String(response.screen?.text)).toContain('опубликованных модулей');
  });

  /** Wizard до экрана подтверждения: модуль, название, описание, дата, пропуски. */
  async function wizardToPreview(
    tgId: number,
    dateText: string,
  ): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.press(tgId, 'Инструменты ментора');
    await transport.press(tgId, 'Создать поток');
    const step1 = await transport.press(tgId, 'Модуль ментора');
    expect(textOf(step1)).toContain('название потока');
    await transport.press(tgId, 'Принять');
    await transport.press(tgId, 'Принять');
    await transport.sendText(tgId, dateText);
    for (let i = 0; i < 5; i++) await transport.press(tgId, 'Пропустить');
    await transport.press(tgId, 'Пропустить');
    await transport.press(tgId, 'Пропустить');
    return transport.press(tgId, 'Пропустить');
  }

  test('P4-48: wizard с неверной датой — отказ валидации, поток не создан', async () => {
    const preview = await wizardToPreview(MGMT_TG.mentor, 'не-дата');
    expect(textOf(preview)).toContain('Превью потока');

    const refused = await transport.press(MGMT_TG.mentor, 'Создать');

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain('Ошибка валидации');
  });

  test('P4-50: устаревшая кнопка «Создать» после снятия ввода — «Контекст потерян»', async () => {
    const preview = await wizardToPreview(MGMT_TG.mentor, '2026-12-15');
    expect(textOf(preview)).toContain('Превью потока');

    // /cancel отпускает диалог: ввод (и контекст wizard-а) снят, экран — меню
    const cancelled = await transport.handleCancel(
      transport.makeBotContext(MGMT_TG.mentor),
    );
    expect(notifyOf(cancelled)).toContain('Создание потока отменено');

    // Кнопка «✅ Создать» со старого экрана, но с актуальным штампом диалога
    const stale = await transport.pressRaw(
      MGMT_TG.mentor,
      'mentor:create-stream:confirm',
    );

    expect(stale.notify?.kind).toBe('warn');
    // В тексте MarkdownV2 дефис экранирован: `wizard\-а`
    expect(notifyOf(stale)).toContain('Контекст wizard');
    expect(notifyOf(stale)).toContain('потерян');
    expect(notifyOf(stale)).toContain('Начните заново');
    expect(stale.release).toBe(true);
  });

  test('P4-52: /cancel без активного wizard — короткое меню без реплики об отмене', async () => {
    await transport.handleStart(transport.makeBotContext(MGMT_TG.mentor));

    const response = await transport.handleCancel(
      transport.makeBotContext(MGMT_TG.mentor),
    );

    expect(textOf(response)).toContain('Главное меню');
    expect(notifyOf(response)).not.toContain('Создание потока отменено');
  });

  // P4-49: ветка стори недостижима — бот принимает только текстовые
  // сообщения (подписка message:text), так же в v0.2.6.
});
