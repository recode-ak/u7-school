import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import { StreamsController } from '@u7-scl/bot/streams/controller';
import type { DialogResponse } from '@u7-scl/core/ui';
import {
  GetStudentByUserUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  pressedCode,
  screensNewFirst,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { Trace } from 'dmg-core/app';
import { CORE_EDUCATION_WORLD, type WorldDefinition } from '../worlds';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** «JS Core — Поток 1»: набор открыт, кодового слова нет. */
const STREAM_WITHOUT_KEY = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
/** «JS Core — Поток 5»: набор открыт, кодовое слово `secret123`. */
const STREAM_WITH_KEY = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4';
const STREAM_KEY = 'secret123';
/** «JS Core — Поток 2»: идёт обучение (не набор). */
const STREAM_ACTIVE = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const UNKNOWN_STREAM = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** Тексты кнопок экрана — плоским списком. */
function buttonsOf(response: DialogResponse): string[] {
  return (response.screen?.keyboard?.rows.flat() ?? []).map((b) => b.text);
}

/** Нажатие кнопки по подстроке текста: код берётся отштампованным из Api-записей. */
async function press(
  transport: TestBotTransport,
  tgId: number,
  textContains: string,
): Promise<DialogResponse> {
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: pressedCode(transport, tgId, textContains),
    }),
  );
}

/** Нажатие «крафтового» кода (адрес вручную) с актуальным штампом экрана. */
async function pressRaw(
  transport: TestBotTransport,
  tgId: number,
  rawCode: string,
): Promise<DialogResponse> {
  return transport.handleCallback(
    transport.makeBotContext(tgId, {
      callbackData: stampedCode(transport, tgId, rawCode),
    }),
  );
}

/** /start → «Школа» → «Потоки» → карточка потока по подстроке названия. */
async function openStreamCard(
  transport: TestBotTransport,
  tgId: number,
  titleContains: string,
): Promise<DialogResponse> {
  await transport.handleStart(transport.makeBotContext(tgId));
  await press(transport, tgId, 'Школа');
  await press(transport, tgId, 'Потоки');
  return press(transport, tgId, titleContains);
}

/** Текст без MarkdownV2-экранирования — для проверки вставленных значений. */
function plain(text: string): string {
  return text.replace(/\\(.)/g, '$1');
}

/** Последнее сообщение боту-пользователю (Api-запись) — что увидел Telegram. */
function lastSentTo(transport: TestBotTransport, tgId: number): string {
  const sent = transport.api.sentMessages.filter((m) => m.telegramId === tgId);
  return String(sent.at(-1)?.text ?? '');
}

/**
 * E2E: запись на поток из карточки (S02 → «📝 Записаться»).
 *
 * Пользовательская история: гость открывает поток, записывается (с кодовым
 * словом и без), ошибается в слове и отменяет ввод. Нажатия — отштампованными
 * кодами из Api-записей, как реальный клиент.
 */
describe('E2E: запись на поток', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('stream-enroll-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  /** Поток живой записи пользователя (`get-student-by-user`), нет записи — undefined. */
  async function enrolledStreamOf(tgId: number): Promise<string | undefined> {
    const actor = await app.userByTelegramId(tgId);
    const result = await app.apiApp.dispatch(
      StreamModuleDef,
      GetStudentByUserUcDef.command({ userId: actor.user.uuid }),
      actor,
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );
    return result.ok ? result.value.streamId : undefined;
  }

  afterAll(async () => {
    await app.cleanup();
  });

  test('P3-55: «Записаться» без кодового слова — зачисление и главное меню', async () => {
    const tgId = 1001;

    const card = await openStreamCard(transport, tgId, 'Поток 1');
    expect(buttonsOf(card)).toContainEqual(
      expect.stringContaining('Записаться'),
    );

    const enrolled = await press(transport, tgId, 'Записаться');
    const notice = String(enrolled.notify?.text ?? '');
    expect(notice).toContain('Вы успешно записаны на поток');
    expect(notice).toContain('JS Core — Поток 1');
    // Ссылка на группу потока в приглашении
    expect(plain(notice)).toContain('https://t.me/+test_enrollment_group');

    // Переход в главное меню (делегат исполняет uiApp — экран в Api-записи)
    const top = screensNewFirst(transport, tgId)[0];
    expect(String(top?.text ?? '')).toContain('Главное меню');

    // Запись заведена: повторно «Записаться» не предлагается
    const reopened = await openStreamCard(transport, tgId, 'Поток 1');
    expect(buttonsOf(reopened).some((t) => t.includes('Записаться'))).toBe(
      false,
    );
  });

  test('P3-56: поток с кодовым словом — запрос слова и кнопка отмены', async () => {
    const tgId = 100000011;

    await openStreamCard(transport, tgId, 'Поток 5');
    const asked = await press(transport, tgId, 'Записаться');

    expect(String(asked.screen?.text ?? '')).toContain(
      'Введите кодовое слово для записи на поток',
    );
    expect(buttonsOf(asked)).toContainEqual(expect.stringContaining('Отмена'));
    // Диалог ждёт текстовый ввод
    expect(asked.awaitInput).toBeDefined();
    expect(transport.dialogOf(tgId)?.input).toBeDefined();
  });

  test('P3-57: верное кодовое слово — зачисление', async () => {
    const tgId = 100000012;

    await openStreamCard(transport, tgId, 'Поток 5');
    await press(transport, tgId, 'Записаться');
    const enrolled = await transport.sendText(tgId, STREAM_KEY);

    const notice = String(enrolled.notify?.text ?? '');
    expect(notice).toContain('Вы успешно записаны на поток');
    expect(notice).toContain('JS Core — Поток 5');
  });

  test('P3-58: неверное слово — реплика с остатком попыток, ввод продолжается', async () => {
    const tgId = 1010;

    await openStreamCard(transport, tgId, 'Поток 5');
    await press(transport, tgId, 'Записаться');

    const first = await transport.sendText(tgId, 'не-то');
    expect(first.notify?.kind).toBe('warn');
    expect(String(first.notify?.text ?? '')).toContain('Неверное слово');
    expect(String(first.notify?.text ?? '')).toContain('Осталось попыток: 2');
    expect(first.awaitInput).toBeDefined();

    const second = await transport.sendText(tgId, 'не-то');
    expect(String(second.notify?.text ?? '')).toContain('Осталось попыток: 1');
    expect(second.awaitInput).toBeDefined();
  });

  test('P3-59: третья неверная попытка — «Попытки исчерпаны», ввод снят', async () => {
    const tgId = 1008;

    await openStreamCard(transport, tgId, 'Поток 5');
    await press(transport, tgId, 'Записаться');
    await transport.sendText(tgId, 'не-то');
    await transport.sendText(tgId, 'не-то');

    const third = await transport.sendText(tgId, 'не-то');
    expect(String(third.screen?.text ?? '')).toContain('Попытки исчерпаны');
    expect(buttonsOf(third)).toContainEqual(
      expect.stringContaining('Назад к потоку'),
    );
    expect(third.awaitInput).toBeUndefined();

    // Ожидание снято: следующий текст до стори не доходит
    await transport.sendText(tgId, 'ещё раз');
    expect(lastSentTo(transport, tgId)).toContain(
      'Сейчас я работаю с кнопками',
    );
  });

  test('P3-60: «❌ Отмена» при вводе слова — возврат на карточку, ввод снят', async () => {
    const tgId = 1007;

    await openStreamCard(transport, tgId, 'Поток 5');
    await press(transport, tgId, 'Записаться');

    const back = await press(transport, tgId, 'Отмена');
    expect(String(back.screen?.text ?? '')).toContain('JS Core — Поток 5');
    expect(back.awaitInput).toBeUndefined();
    expect(transport.dialogOf(tgId)?.input).toBeUndefined();
  });

  // P3-61, P3-62: реплики стори недостижимы — текст вне запроса слова
  // перехватывает транспорт (P1-33, transport.e2e), нетекстовые апдейты бот
  // не принимает (подписка только на message:text); так же в v0.2.6.

  test('P3-63: уже есть живая запись — отказ без зачисления', async () => {
    const tgId = 1003;
    const before = await enrolledStreamOf(tgId);
    expect(before).toBeDefined();

    await openStreamCard(transport, tgId, 'Поток 1');
    // Кнопки «Записаться» нет (запись уже есть) — адрес набирается вручную
    const refused = await pressRaw(
      transport,
      tgId,
      `stream:view-stream:enroll:${STREAM_WITHOUT_KEY}`,
    );

    expect(refused.notify?.kind).toBe('warn');
    expect(String(refused.notify?.text ?? '')).toContain(
      'уже проходите обучение',
    );
    expect(String(refused.notify?.text ?? '')).not.toContain(
      'Вы успешно записаны',
    );
    expect(await enrolledStreamOf(tgId)).toBe(before);
  });

  test('P3-63: поток не найден — отказ без зачисления', async () => {
    const tgId = 1005;

    await openStreamCard(transport, tgId, 'Поток 1');
    const refused = await pressRaw(
      transport,
      tgId,
      `stream:view-stream:enroll:${UNKNOWN_STREAM}`,
    );

    expect(refused.notify?.kind).toBe('warn');
    expect(String(refused.notify?.text ?? '')).toContain('Поток не найден');
  });

  // P3-63 (F-4C): адрес вручную на поток в обучении — отказ «набор закрыт».
  test('P3-63: поток не в наборе — отказ без зачисления', async () => {
    const tgId = 1009;

    await openStreamCard(transport, tgId, 'Поток 2');
    const refused = await pressRaw(
      transport,
      tgId,
      `stream:view-stream:enroll:${STREAM_ACTIVE}`,
    );

    expect(refused.notify?.kind).toBe('warn');
    expect(String(refused.notify?.text ?? '')).toContain(
      'Набор на поток закрыт',
    );
    expect(String(refused.notify?.text ?? '')).not.toContain(
      'Вы успешно записаны',
    );
    expect(await enrolledStreamOf(tgId)).not.toBe(STREAM_ACTIVE);
  });
});

/**
 * Мир с потоком на второй модуль курса: допуск требует пройденного
 * предыдущего модуля (в базовом мире все потоки — на первом модуле).
 */
const WORLD_WITH_GATE_STREAM: WorldDefinition = {
  ...CORE_EDUCATION_WORLD,
  name: 'stream-enroll-gate',
  streams: [
    ...(CORE_EDUCATION_WORLD.streams ?? []),
    {
      key: 'stream-gate',
      uuid: 'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7',
      title: 'JS Core — Поток 6 (второй модуль)',
      description: 'Поток на второй модуль курса «Основы программирования».',
      courseKey: 'course-js-basics',
      moduleId: 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
      mentorKey: 'dev',
      status: 'enrollment',
      startedAt: 'T+20d',
      contentSnapshot: [
        {
          projectId: 'b9b9b9b9-b9b9-49b9-89b9-b9b9b9b9b9b9',
          projectTitle: 'Проект второго модуля',
          lessons: [
            {
              lessonId: 'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9',
              lessonTitle: 'Урок второго модуля',
              stepIds: ['d9d9d9d9-d9d9-49d9-89d9-d9d9d9d9d9d9'],
            },
          ],
        },
      ],
    },
  ],
};

describe('E2E: запись на поток — допуск к модулю', () => {
  let app: TestApp;
  let transport: TestBotTransport;

  beforeAll(async () => {
    app = await createTestApp('stream-enroll-gate-e2e', WORLD_WITH_GATE_STREAM);
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new SchoolController(),
      new StreamsController(),
    ]);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P3-63: не пройден предыдущий модуль — отказ с названием модуля', async () => {
    const tgId = 1001;

    const card = await openStreamCard(transport, tgId, 'Поток 6');
    expect(buttonsOf(card)).toContainEqual(
      expect.stringContaining('Записаться'),
    );

    const refused = await press(transport, tgId, 'Записаться');
    expect(refused.notify?.kind).toBe('warn');
    expect(String(refused.notify?.text ?? '')).toContain(
      'Сначала пройдите модуль',
    );
    expect(String(refused.notify?.text ?? '')).toContain('JavaScript Основы');
    expect(String(refused.notify?.text ?? '')).not.toContain(
      'Вы успешно записаны',
    );
  });
});
