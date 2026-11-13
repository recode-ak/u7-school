import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import { MentorController } from '@u7-scl/bot/mentor/controller';
import { SchoolController } from '@u7-scl/bot/school/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { md, mdRaw } from '@u7-scl/core/shared';
import type { DialogResponse } from '@u7-scl/core/ui';
import type { Api } from 'grammy';
import type { BotContext } from '../../src/context';
import { BotTransport } from '../../src/infra/bot-transport';
import { JsonBotSessionRepo } from '../../src/infra/json-bot-session-repo';
import { createTestApp, type TestApp } from '../helpers/test-app';
import {
  createTestBotTransport,
  currentStamp,
  pressedCode,
  RecordingBotApi,
  screensNewFirst,
  type TestBotTransport,
} from '../helpers/test-bot-transport';

const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

const GUEST_TG = 1001;
const STUDENT_TG = 1003;
const MENTOR_TG = 1004;
const ADMIN_TG = 1005;

/** Курс «Основы программирования» — его UUID попадает в callback_data каталога. */
const COURSE_ID = 'fafafafa-baba-4aba-8aba-babababababa';

/** Тексты подсказок и алертов транспорта (как их видит пользователь). */
const NO_DIALOG = 'Наберите /start';
const STALE_STAMP = 'Экран устарел';
const STALE_BUTTON = 'Похоже, эта кнопка устарела после перезапуска сервиса';
const NO_INPUT_NO_DIALOG =
  'Сначала наберите /start — потом я смогу принимать сообщения.';
const INPUT_NOT_EXPECTED =
  'Сейчас я работаю с кнопками — сообщения не принимаются';

/** Кнопки последнего экрана пользователя (по записям Api). */
function lastScreenButtons(
  transport: TestBotTransport,
  tgId: number,
): Array<{ text: string; code: string }> {
  const screen = screensNewFirst(transport, tgId)[0];
  return screen?.keyboard?.rows.flat() ?? [];
}

/**
 * E2E граничных путей транспорта (ФР-3/ФР-4): нажатия без диалога, мёртвые
 * штампы и shortId, текст вне ввода, слэш-команды через `message:text`,
 * рендер-политика §5 (свой/чужой экран, notify, /start), сбои Telegram API,
 * очередь чата, сжатие UUID, персистентность сессий.
 *
 * Стенд: реальный `BotTransport` + реальный `U7BotUiApp` + Api-запись
 * (`TestBotTransport`). Кнопки нажимаются кодами из Api-записи — как клиент.
 */
describe('E2E: транспорт — нажатия и ввод', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('transport-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL, [ADMIN_TG]),
      new SchoolController(),
      new CoursesController(),
      new MentorController(),
    ]);
    guest = await app.userByTelegramId(GUEST_TG);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P1-28: нажатие кнопки до первого /start — alert «Наберите /start», до uiApp не доходит', async () => {
    const tgId = guest.user.view().telegramId;

    const response = await transport.pressWithoutDialog(
      tgId,
      'app:main-menu:~1',
    );

    expect(transport.alerts).toEqual([NO_DIALOG]);
    // Ответа uiApp нет и в чат ничего не ушло
    expect(response).toEqual({});
    expect(transport.api.sentMessages).toEqual([]);
    expect(transport.api.editedMessages).toEqual([]);
  });

  test('P1-30: неизвестный shortId (кнопка из прошлой жизни сервиса) — alert про устаревшую кнопку', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));

    const response = await transport.pressUnknownShortId(tgId, 'app:main-menu');

    expect(response).toEqual({});
    expect(transport.alerts).toHaveLength(1);
    expect(transport.alerts[0]).toContain(STALE_BUTTON);
    expect(transport.alerts[0]).toContain('/start');
  });

  test('P1-31: дубль-тап по кнопке-мосту — первое нажатие открывает диалог, второе «Экран устарел»', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const code = pressedCode(transport, tgId, 'Школа');
    // Штамп кнопки — эпоха открытого диалога меню
    expect(code).toEndWith(`:${currentStamp(transport, tgId)}`);

    const [first, second] = await transport.doubleTap(tgId, code);

    expect(String(first.screen?.text)).toContain('U7 School');
    expect(second).toEqual({});
    expect(transport.alerts).toHaveLength(1);
    expect(transport.alerts[0]).toContain(STALE_STAMP);
  });

  test('P1-32: текст без «/» до /start — подсказка про /start', async () => {
    const tgId = guest.user.view().telegramId;
    // Диалога нет (как у нового пользователя)
    transport.dropSession(tgId);

    const response = await transport.sendText(tgId, 'привет');

    expect(response).toEqual({});
    expect(transport.api.sentMessages).toHaveLength(1);
    expect(transport.api.sentMessages[0]?.text).toBe(NO_INPUT_NO_DIALOG);
    // Диалог не открылся: активного диалога у пользователя нет
    expect(transport.dialogOf(tgId)).toBeUndefined();
  });

  test('P1-33: текст без «/» при открытом диалоге без ожидания ввода — подсказка «работаю с кнопками»', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));

    const response = await transport.sendText(tgId, 'просто текст');

    expect(response).toEqual({});
    const hint = transport.api.sentMessages.at(-1);
    expect(hint?.text).toContain(INPUT_NOT_EXPECTED);
    expect(hint?.text).toContain('/help');
  });

  test('P1-35: слэш-текст через message:text — команда с суффиксом @bot и args', async () => {
    const guestTg = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(guestTg));

    // `/help@bot` — суффикс срезается, команда распознана
    const help = await transport.sendText(guestTg, '/help@u7_school_bot');
    expect(help.notify?.text).toContain('Как со мной работать?');

    // args — остаток строки: /log_level получает уровень
    const adminTg = ADMIN_TG;
    await transport.handleStart(transport.makeBotContext(adminTg));
    const logLevel = await transport.sendText(adminTg, '/log_level   info  ');
    expect(logLevel.notify?.text).toContain(
      'Уровень логирования изменён на: info',
    );
  });

  test('P8-31: слэш-текст, не разбираемый как команда, тихо игнорируется', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const sentBefore = transport.api.sentMessages.length;
    const editedBefore = transport.api.editedMessages.length;

    for (const text of ['/', '/@u7_school_bot']) {
      const response = await transport.sendText(tgId, text);
      expect(response).toEqual({});
    }

    expect(transport.api.sentMessages.length).toBe(sentBefore);
    expect(transport.api.editedMessages.length).toBe(editedBefore);
    expect(transport.alerts).toEqual([]);
  });
});

describe('E2E: транспорт — рендер-политика §5', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('transport-render-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL, [ADMIN_TG]),
      new SchoolController(),
      new CoursesController(),
    ]);
    guest = await app.userByTelegramId(GUEST_TG);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** /start → «📖 Курсы»: экран каталога в диалоге course/course-catalog. */
  async function openCatalog(tgId: number): Promise<DialogResponse> {
    await transport.handleStart(transport.makeBotContext(tgId));
    return transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Курсы'),
      }),
    );
  }

  test('P1-36: ответ своего диалога — edit на месте со штампом (drill-down каталога)', async () => {
    const tgId = guest.user.view().telegramId;
    await openCatalog(tgId);
    const catalogMessageId = transport.api.sentMessages.at(-1)?.messageId;
    const sentBefore = transport.api.sentMessages.length;

    // Первая кнопка карточки курса — этап программы (UUID сжат в shortId)
    const phaseButton = lastScreenButtons(transport, tgId)[0];
    expect(phaseButton).toBeDefined();
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: phaseButton!.code }),
    );

    expect(String(response.screen?.text)).toContain('Синтаксис');
    // Свой экран переписан edit-ом, нового сообщения нет
    expect(transport.api.sentMessages.length).toBe(sentBefore);
    const lastEdit = transport.api.editedMessages.at(-1);
    expect(lastEdit?.messageId).toBe(catalogMessageId);
    // Штамп на кнопках нового экрана — тот же seq (диалог не менялся)
    expect(transport.dialogOf(tgId)?.path).toBe('course/course-catalog');
  });

  test('P1-36: ответ чужого диалога — прежний экран гасится с маркером «Вы выбрали», новый отправляется', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const menuMessageId = transport.api.sentMessages.at(-1)?.messageId;

    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Школа'),
      }),
    );

    expect(String(response.screen?.text)).toContain('U7 School');
    // Старый экран погашен с маркером выбора (текст кнопки)
    const retired = transport.api.editedMessages.find(
      (m) => m.messageId === menuMessageId,
    );
    expect(retired?.text).toContain('—————');
    expect(retired?.text).toContain('Вы выбрали:');
    expect(retired?.text).toContain('Школа');
    // Новый экран — новым сообщением
    expect(transport.api.sentMessages.at(-1)?.text).toContain('U7 School');
  });

  test('P1-36: notify-реплика не трогает экран и клавиатуру диалога', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Школа'),
      }),
    );
    const editedBefore = transport.api.editedMessages.length;
    const sentBefore = transport.api.sentMessages.length;

    const help = await transport.handleHelp(transport.makeBotContext(tgId));

    expect(help.screen).toBeUndefined();
    expect(help.notify?.text).toContain('Как со мной работать?');
    // Реплика — новым сообщением, экран не перерисован
    expect(transport.api.editedMessages.length).toBe(editedBefore);
    const delivered = transport.api.sentMessages.slice(sentBefore);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.keyboard).toBeUndefined();
  });

  test('P1-36: /start — прежний экран гасится без маркера, приветствие отправляется', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Школа'),
      }),
    );
    const hubMessageId = transport.api.sentMessages.at(-1)?.messageId;
    const hubText = transport.api.sentMessages.at(-1)?.text;
    const sentBefore = transport.api.sentMessages.length;

    const welcome = await transport.handleStart(transport.makeBotContext(tgId));

    expect(String(welcome.screen?.text)).toContain('Привет');
    const retired = transport.api.editedMessages.find(
      (m) => m.messageId === hubMessageId,
    );
    // Retire без маркера: текст прежнего экрана сохранён, выбора не было
    expect(retired?.text).toBe(hubText);
    expect(retired?.text).not.toContain('—————');
    expect(transport.api.sentMessages.length).toBe(sentBefore + 1);
  });
});

describe('E2E: транспорт — сбои, очередь, callback_data, персистентность', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('transport-failures-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL, [ADMIN_TG]),
      new SchoolController(),
      new CoursesController(),
      new MentorController(),
    ]);
    guest = await app.userByTelegramId(GUEST_TG);
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  test('P1-37: сбой Telegram API при отправке — обработчик не падает, в чат ничего не уходит', async () => {
    const tgId = guest.user.view().telegramId;
    transport.api.failNext('sendMessage');

    const response = await transport.handleStart(
      transport.makeBotContext(tgId),
    );

    // Ответ uiApp собран, но доставка не удалась (warn-лог, без исключения)
    expect(String(response.screen?.text)).toContain('Привет');
    expect(transport.api.sentMessages).toEqual([]);
    // Сессия открыта: следующий /start доставляется штатно
    await transport.handleStart(transport.makeBotContext(tgId));
    expect(transport.api.sentMessages).toHaveLength(1);
  });

  test('P1-38: параллельные нажатия одного чата — порядок сохранён, второй штамп устарел', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const code = pressedCode(transport, tgId, 'Школа');
    transport.answers.length = 0;

    const responses = await transport.pressConcurrently(tgId, code, 2);

    // Оба апдейта обработаны по порядку: первый переключил диалог, второй — alert
    expect(responses).toHaveLength(2);
    expect(String(responses[0]?.screen?.text)).toContain('U7 School');
    expect(responses[1]).toEqual({});
    expect(transport.answers).toHaveLength(2);
    expect(transport.alerts).toHaveLength(1);
    expect(transport.alerts[0]).toContain(STALE_STAMP);
  });

  test('P1-38: падение первой работы в очереди не роняет хвост (следующее нажатие обработано)', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const code = pressedCode(transport, tgId, 'Школа');

    // Первая работа очереди — битый markdown проактива (fail-fast, исключение)
    const broken = transport.transport.notify(tgId, {
      text: mdRaw('битый *markdown'),
    });
    const press = transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: code }),
    );

    await expect(broken).rejects.toThrow();
    const response = await press;
    expect(String(response.screen?.text)).toContain('U7 School');
  });

  test('P1-39: UUID в callback_data сжимается в shortId, нажатие разжимается (round-trip)', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Курсы'),
      }),
    );

    const catalog = transport.api.sentMessages.at(-1);
    const codes = (catalog?.keyboard?.rows.flat() ?? []).map((b) => b.code);
    expect(codes.length).toBeGreaterThan(0);
    const phaseCode = codes[0] ?? '';
    // UUID сжат до `~<hex8>` (первые 8 hex-символов), полного UUID в коде нет
    expect(phaseCode).toContain(`:~${COURSE_ID.slice(0, 8)}:`);
    expect(phaseCode).not.toContain(COURSE_ID);
    // Код влезает в лимит Telegram 64 байта вместе со штампом
    expect(new TextEncoder().encode(phaseCode).length).toBeLessThanOrEqual(64);

    // Разжатие: нажатие сжатой кнопки доводит до экрана этапа
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: phaseCode }),
    );
    expect(String(response.screen?.text)).toContain('Синтаксис');
    expect(String(response.screen?.text)).not.toContain('Неизвестная команда');
  });

  test('P1-39: код `app:` не сжимается — только штамп', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Школа'),
      }),
    );

    const menuCode = pressedCode(transport, tgId, 'Главное меню');
    expect(menuCode).toBe(`app:main-menu:${currentStamp(transport, tgId)}`);
  });

  test('P1-52: уведомление с битым markdown — fail-fast, в Telegram не уходит', async () => {
    const tgId = guest.user.view().telegramId;

    const broken = transport.transport.notify(tgId, {
      text: mdRaw('битый *markdown'),
    });

    await expect(broken).rejects.toThrow();
    expect(transport.api.sentMessages).toEqual([]);
  });

  test('P1-53: уведомление при ожидании ввода — ввод жив, экран не тронут', async () => {
    const tgId = MENTOR_TG;
    // Ментор → «Инструменты ментора» → «Создать поток»: wizard ставит awaitInput
    await transport.handleStart(transport.makeBotContext(tgId));
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Инструменты ментора'),
      }),
    );
    await transport.handleCallback(
      transport.makeBotContext(tgId, {
        callbackData: pressedCode(transport, tgId, 'Создать поток'),
      }),
    );
    expect(transport.dialogOf(tgId)?.input).toBeDefined();
    const editedBefore = transport.api.editedMessages.length;

    await transport.transport.notify(tgId, {
      text: md`Проверка доставки`,
      kind: 'info',
    });

    // Ввод не снят, экран не перерисован, уведомление доставлено
    expect(transport.dialogOf(tgId)?.input).toBeDefined();
    expect(transport.api.editedMessages.length).toBe(editedBefore);
    const delivered = transport.api.sentMessages.at(-1);
    expect(delivered?.text).toContain('ℹ️ *Информация:*');
    expect(delivered?.text).toContain('Проверка доставки');
    expect(delivered?.keyboard).toBeUndefined();
  });

  test('P1-59: приглашение без диалога — временный якорь app/invite, кнопка не умирает', async () => {
    const tgId = guest.user.view().telegramId;
    // Как после рестарта сервиса: сессии нет
    transport.dropSession(tgId);

    await transport.transport.invite(tgId, {
      text: md`Приглашение в поток`,
      keyboard: {
        rows: [[{ text: '🏫 Школа', code: 'school:hub:open' }]],
        isMultiple: false,
      },
    });

    // Временный диалог-якорь: seq=1, кнопка отштампована им
    expect(transport.dialogOf(tgId)?.path).toBe('app/invite');
    expect(transport.dialogOf(tgId)?.seq).toBe(1);
    const code = pressedCode(transport, tgId, 'Школа');
    expect(code).toEndWith(':~1');

    // Нажатие из приглашения работает (не «Экран устарел») и switch-ит диалог
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: code }),
    );
    expect(String(response.screen?.text)).toContain('U7 School');
    expect(transport.alerts).toEqual([]);
    expect(transport.dialogOf(tgId)?.path).toBe('school/hub');
  });

  test('P1-59: приглашение при открытом диалоге — кнопки штампуются текущим seq', async () => {
    const tgId = guest.user.view().telegramId;
    await transport.handleStart(transport.makeBotContext(tgId));
    const seq = transport.dialogOf(tgId)?.seq;
    expect(seq).toBeDefined();

    await transport.transport.invite(tgId, {
      text: md`Приглашение в поток`,
      keyboard: {
        rows: [[{ text: '🏫 Школа', code: 'school:hub:open' }]],
        isMultiple: false,
      },
    });

    // Диалог не переоткрывался — приглашение встало в текущую эпоху
    expect(transport.dialogOf(tgId)?.seq).toBe(seq);
    const code = pressedCode(transport, tgId, 'Школа');
    expect(code).toEndWith(`:~${(seq ?? 0).toString(36)}`);
    const response = await transport.handleCallback(
      transport.makeBotContext(tgId, { callbackData: code }),
    );
    expect(String(response.screen?.text)).toContain('U7 School');
  });

  test('P1-40: рестарт — сессии и shortId восстанавливаются, старые кнопки живы', async () => {
    const tgId = guest.user.view().telegramId;
    const dir = mkdtempSync(join(tmpdir(), 'u7-bot-restart-'));
    try {
      const repoFiles = () =>
        new JsonBotSessionRepo(
          join(dir, 'sessions.json'),
          join(dir, 'short-ids.json'),
        );
      /** Контекст с update_id: BotTransport ведёт апдейт в BotRequestContext. */
      const ctx = (
        updateId: number,
        payload: { text: string } | { callbackData: string },
      ): BotContext => {
        const base = transport.makeBotContext(
          tgId,
          'callbackData' in payload
            ? { callbackData: payload.callbackData }
            : {},
        );
        (base as { update: unknown }).update = { update_id: updateId };
        if ('text' in payload) {
          (base as { message: unknown }).message = { text: payload.text };
        }
        return base;
      };

      // Первый процесс: /start → каталог курсов (кладёт сессию и shortId)
      const apiFirst = new RecordingBotApi();
      const before = new BotTransport(
        transport.uiApp,
        apiFirst as unknown as Api,
        repoFiles(),
      );
      await before.handleCommand(ctx(1, { text: '/start' }));
      const menuCode = apiFirst.sentMessages
        .at(-1)
        ?.keyboard?.rows.flat()
        .find((b) => b.text.includes('Курсы'))?.code;
      if (menuCode === undefined) throw new Error('нет кнопки «Курсы»');
      await before.handleCallback(ctx(2, { callbackData: menuCode }));

      const catalogCode = apiFirst.sentMessages
        .at(-1)
        ?.keyboard?.rows.flat()[0]?.code;
      if (catalogCode === undefined) {
        throw new Error('каталог курсов без кнопок');
      }
      const dialogBefore = apiFirst.sentMessages.length;

      // Рестарт: новый процесс восстанавливает сессии и shortId из файлов
      const apiAfter = new RecordingBotApi();
      const after = new BotTransport(
        transport.uiApp,
        apiAfter as unknown as Api,
        repoFiles(),
      );
      await after.restore();

      // Старая кнопка (сжатый shortId из прошлого процесса) нажимается
      await after.handleCallback(ctx(3, { callbackData: catalogCode }));
      expect(transport.alerts).toEqual([]);
      expect(
        apiAfter.sentMessages.length + apiAfter.editedMessages.length,
      ).toBeGreaterThan(0);
      // Диалог продолжается: второй экран каталога, не меню и не ошибка
      const screens = [...apiAfter.sentMessages, ...apiAfter.editedMessages];
      expect(screens.map((s) => s.text).join('\n')).toContain('Курс');
      expect(apiFirst.sentMessages.length).toBe(dialogBefore);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
