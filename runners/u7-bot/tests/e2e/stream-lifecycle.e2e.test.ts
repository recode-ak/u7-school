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
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import type { DialogResponse } from '@u7-scl/core/ui';
import {
  GetStreamUcDef,
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
  StreamDef,
  StudentDef,
  WorldDefinition,
} from '../worlds';
import { deterministicUuid } from '../worlds/uuid';

/**
 * E2E жизненного цикла потока (S02m): запуск набора, завершение обучения,
 * архив — кнопки менторской карточки и отказы домена.
 *
 * Мир — производный: каждый статус потока и каждая ветка отказа получают
 * свой поток, чтобы мутирующие сценарии не влияли друг на друга. Роли:
 * `dev` — ментор-владелец, `mentor2` — чужой ментор, `admin` — администратор.
 */

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const ANCHOR = new Date('2026-10-01T12:00:00.000Z');

const COURSE_ID = 'cb000001-0000-4000-8000-000000000001';
const MODULE_ID = 'ab000001-0000-4000-8000-000000000001';
const PROJECT_ID = 'bb000001-0000-4000-8000-000000000001';
const LESSON_ID = 'cb000001-0000-4000-8000-000000000002';
const STEP1_ID = 'db000001-0000-4000-8000-000000000001';
const STEP2_ID = 'db000002-0000-4000-8000-000000000002';

const streamId = (key: string): string => deterministicUuid(`stream:${key}`);
const studentId = (key: string): string => deterministicUuid(`student:${key}`);

const TG = {
  mentor: 1004,
  admin: 1005,
  otherMentor: 1009,
  enrolled: 1201,
  busy: 1202,
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

/** Поток ментора `dev` в заданном статусе: набор → обучение → итог → архив. */
function devStream(
  key: string,
  title: string,
  status: 'enrollment' | 'active' | 'completed' | 'archived',
): StreamDef {
  return {
    key,
    uuid: streamId(key),
    title,
    description: `Поток «${title}» для e2e жизненного цикла.`,
    courseKey: 'course-lifecycle',
    moduleKey: 'mod-lifecycle',
    mentorKey: 'dev',
    status,
    startedAt: 'T-20d',
    telegramGroupId: `-10088888888${status === 'enrollment' ? '01' : '02'}`,
  };
}

const LIFECYCLE_WORLD: WorldDefinition = {
  name: 'stream-lifecycle',
  description: 'Мир потоков во всех статусах для e2e жизненного цикла',
  anchorDate: ANCHOR,
  persons: [
    mentorPerson('dev', 'Ментор', TG.mentor),
    mentorPerson('mentor2', 'Второй ментор', TG.otherMentor),
    {
      key: 'admin',
      name: 'Администратор',
      telegramId: TG.admin,
      roles: [Role.ADMIN],
      registeredAt: 'T-90d',
    },
    learner('learner-enrolled', 'Зачисленный', TG.enrolled),
    learner('learner-busy', 'Учащийся', TG.busy),
  ],
  courses: [
    {
      key: 'course-lifecycle',
      uuid: COURSE_ID,
      title: 'Курс «Жизненный цикл»',
      description: 'Курс для e2e сценариев потоков.',
      authorKey: 'dev',
      modules: [
        {
          key: 'mod-lifecycle',
          uuid: MODULE_ID,
          title: 'Модуль «Жизненный цикл»',
          description: 'Модуль с двумя шагами.',
          projects: [
            {
              key: 'proj-lifecycle',
              uuid: PROJECT_ID,
              title: 'Проект потока',
              lessons: [
                {
                  key: 'less-lifecycle',
                  uuid: LESSON_ID,
                  title: 'Урок потока',
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
  streams: [
    devStream('stream-launch', 'JS Core — набор', 'enrollment'),
    devStream('stream-not-ready', 'JS Core — черновик', 'enrollment'),
    devStream('stream-foreign', 'JS Core — чужой', 'enrollment'),
    devStream('stream-live', 'JS Core — идёт', 'active'),
    devStream('stream-complete', 'JS Core — к завершению', 'active'),
    devStream('stream-busy', 'JS Core — с учащимся', 'active'),
    devStream('stream-wrong', 'JS Core — устаревший экран', 'active'),
    devStream('stream-done', 'JS Core — завершён', 'completed'),
    devStream('stream-archive', 'JS Core — в архив', 'completed'),
    devStream('stream-archived', 'JS Core — архив', 'archived'),
  ],
  students: [
    {
      key: 'stud-enrolled',
      personKey: 'learner-enrolled',
      streamKey: 'stream-launch',
      enrolledAt: 'T-5d',
      status: 'enrolled',
      steps: [],
    } satisfies StudentDef,
    {
      key: 'stud-busy',
      personKey: 'learner-busy',
      streamKey: 'stream-busy',
      enrolledAt: 'T-19d',
      status: 'active',
      currentStepKey: 'step-one',
      steps: [{ stepKey: 'step-one', status: 'issued', issuedAt: 'T-18d' }],
    } satisfies StudentDef,
  ],
};

interface Stand {
  app: TestApp;
  transport: TestBotTransport;
  mentor: U7BotActor;
  admin: U7BotActor;
}

async function createStand(): Promise<Stand> {
  const app = await createTestApp('stream-lifecycle-e2e', LIFECYCLE_WORLD);
  const transport = createTestBotTransport(app, [
    new AppController(SCHOOL_GROUP_URL),
    new MentorController(),
  ]);
  return {
    app,
    transport,
    mentor: await app.userByTelegramId(TG.mentor),
    admin: await app.userByTelegramId(TG.admin),
  };
}

describe('E2E: жизненный цикл потока — запуск, завершение, архив', () => {
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

  /**
   * Код со штампом заново открытого экрана: каждый апдейт сдвигает
   * `dialog.seq`, поэтому реплика-отказ (без экрана) оставляет старый штамп
   * невалидным — перед следующим крафтовым нажатием экран открывается снова.
   */
  async function craft(tgId: number, rawCode: string): Promise<DialogResponse> {
    await stand.transport.handleStart(stand.transport.makeBotContext(tgId));
    return stand.transport.pressRaw(tgId, rawCode);
  }

  /** /start → «🛠️ Инструменты ментора» → «📋 Мои потоки». */
  async function openMyStreams(tgId: number): Promise<DialogResponse> {
    await stand.transport.handleStart(stand.transport.makeBotContext(tgId));
    await stand.transport.press(tgId, 'Инструменты ментора');
    return stand.transport.press(tgId, 'Мои потоки');
  }

  /** Карточка потока из списка ментора (с включением нужных фильтров). */
  async function openStreamCard(
    tgId: number,
    title: string,
    opts: { completed?: boolean } = {},
  ): Promise<DialogResponse> {
    await openMyStreams(tgId);
    if (opts.completed) await stand.transport.press(tgId, 'Вкл. завершённые');
    return stand.transport.press(tgId, title);
  }

  /** Поток после сценария: статус и право управления с точки зрения ментора. */
  async function streamState(key: string) {
    return expectOk(
      await stand.app.apiApp.dispatch(
        StreamModuleDef,
        GetStreamUcDef.command({ streamId: streamId(key) }),
        stand.mentor,
        testTrace(),
      ),
    );
  }

  /** Запись студента после сценария. */
  async function studentRecord(key: string) {
    return expectOk(
      await stand.app.apiApp.dispatch(
        StreamModuleDef,
        GetStudentProgressUcDef.command({ studentId: studentId(key) }),
        stand.mentor,
        testTrace(),
      ),
    ).student;
  }

  // ── Запуск потока ──

  test('P4-09: «🚀 Запустить» на наборе — поток идёт, первый шаг выдан студентам', async () => {
    const card = await openStreamCard(TG.mentor, 'JS Core — набор');
    expect(Screen.of(card).texts()).toContain('🚀 Запустить');

    const launched = await stand.transport.press(TG.mentor, 'Запустить');

    expect(textOf(launched)).toContain('Поток запущен');
    expect(textOf(launched)).toContain('Первые задания выданы студентам');
    expect(Screen.of(launched).texts()).toContain('⬅️ Назад к потоку');

    const stream = await streamState('stream-launch');
    expect(stream.status).toBe('active');

    const record = await studentRecord('stud-enrolled');
    expect(record.status).toBe('active');
    expect(record.steps).toHaveLength(1);
    expect(record.steps[0]?.stepId).toBe(STEP1_ID);
    expect(record.steps[0]?.status).toBe('issued');
  });

  // ── Завершение обучения ──

  test('P4-10: «✅ Завершить» на идущем потоке — подтверждение, «❌ Отмена» возвращает карточку', async () => {
    const card = await openStreamCard(TG.mentor, 'JS Core — идёт');
    expect(Screen.of(card).texts()).toContain('✅ Завершить');

    const confirm = await stand.transport.press(TG.mentor, 'Завершить');
    expect(textOf(confirm)).toContain('Завершить поток?');
    expect(textOf(confirm)).toContain('остановит обучение');
    expect(Screen.of(confirm).texts()).toEqual([
      '✅ Да, завершить',
      '❌ Отмена',
    ]);

    const back = await stand.transport.press(TG.mentor, 'Отмена');

    expect(textOf(back)).toContain('JS Core — идёт');
    expect(Screen.of(back).texts()).toContain('✅ Завершить');
  });

  test('P4-11: «✅ Да, завершить» — поток завершён, экран «Поток завершён!»', async () => {
    await openStreamCard(TG.mentor, 'JS Core — к завершению');
    await stand.transport.press(TG.mentor, 'Завершить');

    const completed = await stand.transport.press(TG.mentor, 'Да, завершить');

    expect(textOf(completed)).toContain('Поток завершён');
    expect(textOf(completed)).toContain('Обучение окончено');
    expect(Screen.of(completed).texts()).toEqual(['⬅️ Назад к списку']);

    expect((await streamState('stream-complete')).status).toBe('completed');
  });

  test('P4-12: завершение с учащимся — отказ «Нельзя завершить поток… ещё учатся»', async () => {
    await openStreamCard(TG.mentor, 'JS Core — с учащимся');
    await stand.transport.press(TG.mentor, 'Завершить');

    const refused = await stand.transport.press(TG.mentor, 'Да, завершить');

    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain('Нельзя завершить поток');
    expect(notifyOf(refused)).toContain('ещё учатся');
    expect(notifyOf(refused)).toContain('Сначала укажите исход для каждого');

    expect((await streamState('stream-busy')).status).toBe('active');
    expect((await studentRecord('stud-busy')).status).toBe('active');
  });

  // ── Архив ──

  test('P4-13: «📁 В архив» на завершённом потоке — подтверждение, «❌ Отмена» возвращает карточку', async () => {
    const card = await openStreamCard(TG.mentor, 'JS Core — завершён', {
      completed: true,
    });
    expect(Screen.of(card).texts()).toContain('📁 В архив');

    const confirm = await stand.transport.press(TG.mentor, 'В архив');
    expect(textOf(confirm)).toContain('Отправить поток в архив?');
    expect(textOf(confirm)).toContain('будет скрыт из витрины');
    expect(Screen.of(confirm).texts()).toEqual(['✅ Да, в архив', '❌ Отмена']);

    const back = await stand.transport.press(TG.mentor, 'Отмена');

    expect(textOf(back)).toContain('JS Core — завершён');
    expect(Screen.of(back).texts()).toContain('📁 В архив');
    expect((await streamState('stream-done')).status).toBe('completed');
  });

  test('P4-14: «✅ Да, в архив» — поток в архиве, экран «Поток перемещён в архив»', async () => {
    await openStreamCard(TG.mentor, 'JS Core — в архив', {
      completed: true,
    });
    await stand.transport.press(TG.mentor, 'В архив');

    const archived = await stand.transport.press(TG.mentor, 'Да, в архив');

    expect(textOf(archived)).toContain('Поток перемещён в архив');
    expect(Screen.of(archived).texts()).toEqual(['⬅️ Назад к списку']);

    expect((await streamState('stream-archive')).status).toBe('archived');
  });

  // ── Отказы домена на устаревшем экране ──

  test('P4-15: lifecycle-действие с неверным статусом — отказ домена репликой warn', async () => {
    const tgId = TG.mentor;

    const notEnrolling = await craft(
      tgId,
      `mentor:activate-stream:activate:${streamId('stream-wrong')}`,
    );
    expect(notEnrolling.notify?.kind).toBe('warn');
    expect(notifyOf(notEnrolling)).toContain('Недопустимый переход статуса');
    expect(notifyOf(notEnrolling)).toContain('не может быть запущен');

    const notCompleted = await craft(
      tgId,
      `mentor:view-stream-mentor:archive-confirm:${streamId('stream-wrong')}`,
    );
    expect(notCompleted.notify?.kind).toBe('warn');
    expect(notifyOf(notCompleted)).toContain(
      'В архив можно отправить только завершённый поток',
    );

    const alreadyArchived = await craft(
      tgId,
      `mentor:view-stream-mentor:archive-confirm:${streamId('stream-archived')}`,
    );
    expect(alreadyArchived.notify?.kind).toBe('warn');
    expect(notifyOf(alreadyArchived)).toContain('Поток уже находится в архиве');

    const notActive = await craft(
      tgId,
      `mentor:view-stream-mentor:complete-confirm:${streamId('stream-not-ready')}`,
    );
    expect(notActive.notify?.kind).toBe('warn');
    expect(notifyOf(notActive)).toContain('не может быть завершён');

    expect((await streamState('stream-wrong')).status).toBe('active');
    expect((await streamState('stream-not-ready')).status).toBe('enrollment');
  });

  // ── Чужой ментор и админ ──

  test('P4-16: чужой ментор — lifecycle-кнопок нет, прямой вызов UC отклонён правами', async () => {
    const tgId = TG.otherMentor;
    await openMyStreams(tgId);

    const card = await stand.transport.pressRaw(
      tgId,
      `mentor:view-stream-mentor:view:${streamId('stream-foreign')}`,
    );
    const buttons = Screen.of(card).texts();

    expect(textOf(card)).toContain('JS Core — чужой');
    expect(buttons.some((t) => t.includes('Запустить'))).toBe(false);
    expect(buttons.some((t) => t.includes('Завершить'))).toBe(false);
    expect(buttons.some((t) => t.includes('В архив'))).toBe(false);
    expect(buttons).toContain('⬅️ Назад к моим потокам');

    const refused = await stand.transport.pressRaw(
      tgId,
      `mentor:activate-stream:activate:${streamId('stream-foreign')}`,
    );
    expect(refused.notify?.kind).toBe('warn');
    expect(notifyOf(refused)).toContain(
      'Недостаточно прав для управления потоком',
    );
    expect((await streamState('stream-foreign')).status).toBe('enrollment');
  });

  test('P4-69: админ — lifecycle-кнопки на чужом потоке есть, в «Моих потоках» его нет', async () => {
    const tgId = TG.admin;

    const list = await openMyStreams(tgId);
    expect(textOf(list)).toContain('Мои потоки');
    expect(textOf(list)).toContain('У вас пока нет потоков');

    const card = await stand.transport.pressRaw(
      tgId,
      `mentor:view-stream-mentor:view:${streamId('stream-foreign')}`,
    );

    expect(textOf(card)).toContain('JS Core — чужой');
    expect(Screen.of(card).texts()).toContain('🚀 Запустить');
  });
});
