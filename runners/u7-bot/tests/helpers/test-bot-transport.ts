import { AsyncLocalStorage } from 'node:async_hooks';
import { TEST_SCHOOL, type U7App } from '@u7-scl/app';
import type { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { ConsoleLogger } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  DialogState,
  KeyboardDescription,
} from '@u7-scl/core/ui';
import { InProcEventBus } from 'dmg-core/app';
import type { Api } from 'grammy';
import type { BotContext } from '../../src/context';
import type {
  U7BotActor,
  U7BotUiAppResolve,
} from '../../src/core/u7-bot-app-meta';
import { U7BotUiApp } from '../../src/core/ui-app';
import { BotTransport } from '../../src/infra/bot-transport';
import type { TestApp } from './test-app';
import { waitUntil } from './wait-until';

/** Администратор мира `core-education` (tg 1005) — от его имени бот регистрирует гостей. */
const WORLD_ADMIN_UUID = '55555555-5555-5555-5555-555555555555';

// ── Записи вызовов мок-Api ──

export interface SentMessage {
  telegramId: number;
  messageId: number;
  text: string;
  keyboard?: KeyboardDescription;
}

export interface EditedMessage {
  telegramId: number;
  messageId: number;
  text: string;
  keyboard?: KeyboardDescription;
}

/** Запись мягкого кика из группы (bot-transport.kickFromGroup: ban + unban). */
export interface KickedMember {
  chatId: string | number;
  telegramId: number;
  unbanned: boolean;
}

/** Ответ на нажатие (`answerCallbackQuery`): `text` — alert, без текста — тихое подтверждение. */
export interface CallbackAnswer {
  telegramId: number;
  text?: string;
}

/** Методы мок-Api, у которых можно запросить сбой (`failNext`). */
export type FailableApiMethod =
  | 'sendMessage'
  | 'editMessageText'
  | 'banChatMember'
  | 'unbanChatMember';

/** Статус участника чата для `chatMember`/`myChatMember`. */
export type ChatMemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface RawReplyMarkup {
  inline_keyboard: Array<
    Array<{ text: string; callback_data?: string; url?: string }>
  >;
}

/**
 * Мок Grammy Api — записывает вызовы sendMessage / editMessageText в массивы,
 * возвращает инкрементальный message_id (как реальный Telegram).
 *
 * Уровень Api = «что увидел Telegram»: сюда транспорт рендерит реплики
 * (с заголовком вида 🔔/ℹ️/⚠️ — единая таблица ФР-5) и экраны (со штампами
 * `:~<seq36>` в кодах кнопок). E2E-сценарии нажимают кнопки, взяв
 * отштампованный код из клавиатуры предыдущего экрана — как реальный клиент.
 */
export class RecordingBotApi {
  readonly sentMessages: SentMessage[] = [];
  readonly editedMessages: EditedMessage[] = [];
  readonly kickedMembers: KickedMember[] = [];
  #nextMessageId = 1;
  readonly #failures = new Map<FailableApiMethod, Error[]>();

  /**
   * Следующий вызов `method` бросит `error` (одноразово; вызовы можно
   * поставить в очередь). Неудавшийся вызов в записи не попадает.
   */
  failNext(
    method: FailableApiMethod,
    error: Error = new Error(`RecordingBotApi: сбой ${method}`),
  ): void {
    const queue = this.#failures.get(method) ?? [];
    queue.push(error);
    this.#failures.set(method, queue);
  }

  #throwIfFailing(method: FailableApiMethod): void {
    const error = this.#failures.get(method)?.shift();
    if (error) throw error;
  }

  reset(): void {
    this.#failures.clear();
    this.sentMessages.length = 0;
    this.editedMessages.length = 0;
    this.kickedMembers.length = 0;
    this.#nextMessageId = 1;
  }

  async sendMessage(
    telegramId: number,
    text: string,
    other?: { reply_markup?: RawReplyMarkup; parse_mode?: 'MarkdownV2' },
  ): Promise<{ message_id: number }> {
    this.#throwIfFailing('sendMessage');
    const messageId = this.#nextMessageId++;
    this.sentMessages.push({
      telegramId,
      messageId,
      text,
      keyboard: this.#toKeyboard(other?.reply_markup),
    });
    return { message_id: messageId };
  }

  async editMessageText(
    telegramId: number,
    messageId: number,
    text: string,
    other?: { reply_markup?: RawReplyMarkup; parse_mode?: 'MarkdownV2' },
  ): Promise<{ message_id: number }> {
    this.#throwIfFailing('editMessageText');
    this.editedMessages.push({
      telegramId,
      messageId,
      text,
      keyboard: this.#toKeyboard(other?.reply_markup),
    });
    return { message_id: messageId };
  }

  /** Мягкий кик: banChatMember + unbanChatMember (bot-transport.kickFromGroup). */
  async banChatMember(
    chatId: string | number,
    telegramId: number,
    _other?: { until_date?: number },
  ): Promise<true> {
    this.#throwIfFailing('banChatMember');
    this.kickedMembers.push({ chatId, telegramId, unbanned: false });
    return true;
  }

  async unbanChatMember(
    chatId: string | number,
    telegramId: number,
  ): Promise<true> {
    this.#throwIfFailing('unbanChatMember');
    const record =
      this.kickedMembers.find(
        (k) =>
          String(k.chatId) === String(chatId) &&
          k.telegramId === telegramId &&
          !k.unbanned,
      ) ?? this.kickedMembers[this.kickedMembers.length - 1];
    if (record) {
      record.unbanned = true;
    }
    return true;
  }

  #toKeyboard(markup?: RawReplyMarkup): KeyboardDescription | undefined {
    if (!markup) return undefined;
    return {
      rows: markup.inline_keyboard.map((row) =>
        row.map((btn) => ({
          text: btn.text,
          code: btn.callback_data ?? '',
          url: btn.url,
        })),
      ),
      isMultiple: false,
    };
  }
}

/**
 * Тестовый подкласс U7BotUiApp: открывает сбор menuButtons (в проде меню
 * собирается только внутри welcome/short/help-экранов). Прод-API не
 * расширяет — метод открывается protected-членом подкласса.
 */
class ExposedMenuUiApp extends U7BotUiApp {
  collectMainMenu(actor: U7BotActor) {
    return this.collectMenuButtons(actor);
  }
}

/**
 * Честный тестовый стенд: реальный BotTransport + мок-Api + реальная
 * сессионная мапа + реальный U7BotUiApp.
 *
 * DialogResponse захватывается на границе uiApp (обёртки handle*): транспорт
 * рендерит ответ сам, восстановление из Api-вызовов теряло бы notify/
 * awaitInput/release и путало реплику с экраном. Api-записи при этом
 * остаются доступными для проактивных сценариев (сообщения другим адресатам)
 * и для проверки штампов/ретира — «что увидел Telegram».
 */
export class TestBotTransport {
  readonly api = new RecordingBotApi();
  readonly uiApp: ExposedMenuUiApp;
  readonly transport: BotTransport;
  /** Ответы на нажатия (`answerCallbackQuery`) — alert-ы и подтверждения. */
  readonly answers: CallbackAnswer[] = [];
  /**
   * Приёмник ответа текущего апдейта: слот привязан к цепочке вызова
   * (`AsyncLocalStorage`), поэтому параллельные апдейты не путают ответы.
   */
  readonly #slot = new AsyncLocalStorage<{ response: DialogResponse | null }>();
  /** Последний выданный update_id: каждый вызов обработчика — новый апдейт. */
  #updateSeq = 0;
  /** Последний апдейт и сессия до него — для повторной доставки (`redeliver`). */
  #lastUpdate?: {
    ctx: BotContext;
    fn: () => Promise<void>;
    sessionBefore?: BotSession;
  };

  constructor(
    apiApp: U7App['apiApp'],
    actorResolver: (tgId: number) => Promise<U7BotActor | null>,
    controllers: U7BotController[],
    opts: {
      eventBus?: U7BotUiAppResolve['eventBus'];
      /** Резолвер `Caller` приложения — субъект команд DMG из stories (`dispatchUc`). */
      callers?: U7BotUiAppResolve['callers'];
      /** Админ бота: от его имени регистрируются гости (по умолчанию — админ мира). */
      botAdminUuid?: string;
    } = {},
  ) {
    this.uiApp = new ExposedMenuUiApp(controllers);
    this.transport = new BotTransport(this.uiApp, this.api as unknown as Api);
    this.uiApp.init(
      {
        // Общая с apiApp шина — события модулей (напр. questionnaire:start)
        // долетают до подписок стори (как в бою: create-ui-app + main.ts)
        eventBus: opts.eventBus ?? new InProcEventBus(new ConsoleLogger()),
        actorResolver,
        appApi: apiApp,
        botAdminUuid: opts.botAdminUuid ?? WORLD_ADMIN_UUID,
        school: TEST_SCHOOL,
        callers: opts.callers ?? {
          resolve: async () => {
            throw new Error('TestBotTransport: резолвер Caller не передан');
          },
        },
      },
      this.transport,
    );
    // Подписки стори на доменные события (в бою вызывается в main.ts)
    this.uiApp.subscribeEvents();
    this.#captureResponses();
  }

  /** Сбрасывает записи Api, ответы на нажатия и заданные сбои (изоляция тестов). */
  reset(): void {
    this.api.reset();
    this.answers.length = 0;
  }

  /** Тексты alert-ов (`answerCallbackQuery` с текстом), по порядку. */
  get alerts(): string[] {
    return this.answers.flatMap((a) => (a.text ? [a.text] : []));
  }

  // ── Доступ к сессиям (e2e: ассерты диалога, эмуляция рестарта) ──

  /**
   * Активный диалог пользователя (path/seq/input) — для e2e-ассертов
   * «диалог переключился в стори», «ввод захвачен».
   */
  dialogOf(tgId: number): DialogState | undefined {
    return sessionsOf(this.transport).get(tgId)?.dialog;
  }

  /**
   * Эмуляция рестарта сервиса: сессии BotTransport живут в памяти
   * процесса и теряются при перезапуске.
   */
  dropSession(tgId: number): void {
    sessionsOf(this.transport).delete(tgId);
  }

  // ── Фабрика мок-контекста ──

  /**
   * Создаёт мок Grammy-контекста, привязанный к сессии из sessionMap.
   * Повторные вызовы для одного tgId возвращают одну и ту же сессию.
   */
  makeBotContext(
    tgId: number,
    opts: {
      callbackData?: string;
      text?: string;
      /** Отправитель: имя и ник в Telegram (по умолчанию — «Test», без ника). */
      from?: { first_name?: string; username?: string };
    } = {},
  ): BotContext {
    return {
      from: {
        id: tgId,
        first_name: opts.from?.first_name ?? 'Test',
        ...(opts.from?.username !== undefined
          ? { username: opts.from.username }
          : {}),
        is_bot: false,
      },
      chat: { id: tgId, type: 'private' },
      reply: async () => ({ message_id: 0 }),
      answerCallbackQuery: async (other?: { text?: string }) => {
        this.answers.push({
          telegramId: tgId,
          ...(other?.text !== undefined ? { text: other.text } : {}),
        });
        return true;
      },
      callbackQuery:
        opts.callbackData !== undefined
          ? { data: opts.callbackData }
          : undefined,
      message: opts.text !== undefined ? { text: opts.text } : undefined,
    } as unknown as BotContext;
  }

  // ── Меню ──

  /** menuButtons актора (приоритеты, kind, action) — сбор реального uiApp. */
  collectMainMenu(actor: U7BotActor) {
    return this.uiApp.collectMainMenu(actor);
  }

  // ── Обработчики (маршруты main.ts) ──

  /** /start — команда (в бою: transport.handleCommand, конверт парсится). */
  async handleStart(ctx: BotContext): Promise<DialogResponse> {
    return this.#command(ctx, '/start');
  }

  /** /help — команда. */
  async handleHelp(ctx: BotContext): Promise<DialogResponse> {
    return this.#command(ctx, '/help');
  }

  /** /cancel — команда. */
  async handleCancel(ctx: BotContext): Promise<DialogResponse> {
    return this.#command(ctx, '/cancel');
  }

  /** Произвольная слэш-команда текстом. */
  async handleCommand(ctx: BotContext, text: string): Promise<DialogResponse> {
    return this.#command(ctx, text);
  }

  /**
   * Нажатие кнопки. Код должен быть отштампован транспорт (:~seq36) —
   * берите его из клавиатуры предыдущего экрана (api.sentMessages /
   * .editedMessages), как это делает реальный клиент.
   */
  async handleCallback(ctx: BotContext): Promise<DialogResponse> {
    return this.#run(ctx, () => this.transport.handleCallback(ctx));
  }

  /** Текстовый ввод в ожидающий диалог (awaitInput). */
  async handleMessage(ctx: BotContext): Promise<DialogResponse> {
    return this.#run(ctx, () => this.transport.handleMessage(ctx));
  }

  // ── Граничные случаи транспорта (F-03) ──

  /**
   * Нажатие до /start: сессия сброшена, диалога нет — транспорт отвечает
   * alert-ом «Наберите /start» и до uiApp не доходит.
   */
  async pressWithoutDialog(
    tgId: number,
    callbackData: string,
  ): Promise<DialogResponse> {
    this.dropSession(tgId);
    return this.handleCallback(this.makeBotContext(tgId, { callbackData }));
  }

  /**
   * Кнопка с shortId, которого нет в мапе (из прошлой жизни сервиса), при
   * живом диалоге: штамп актуальный, поэтому срабатывает именно разжатие.
   * Диалог должен быть открыт (`/start`).
   */
  async pressUnknownShortId(
    tgId: number,
    action: string,
  ): Promise<DialogResponse> {
    const callbackData = `${action}:~deadbeef:${currentStamp(this, tgId)}`;
    return this.handleCallback(this.makeBotContext(tgId, { callbackData }));
  }

  /** Дубль-тап: одна кнопка нажата дважды подряд (второй — со старым штампом). */
  async doubleTap(
    tgId: number,
    code: string,
  ): Promise<[DialogResponse, DialogResponse]> {
    const first = await this.handleCallback(
      this.makeBotContext(tgId, { callbackData: code }),
    );
    const second = await this.handleCallback(
      this.makeBotContext(tgId, { callbackData: code }),
    );
    return [first, second];
  }

  /**
   * `count` апдейтов с одним кодом без `await` между ними (гонка в очереди
   * чата). Ответы — в порядке доставки.
   */
  async pressConcurrently(
    tgId: number,
    code: string,
    count = 2,
  ): Promise<DialogResponse[]> {
    return Promise.all(
      Array.from({ length: count }, () =>
        this.handleCallback(this.makeBotContext(tgId, { callbackData: code })),
      ),
    );
  }

  /** Нажатие кнопки с последнего экрана по фрагменту текста (код — из клавиатуры). */
  async press(tgId: number, textContains: string): Promise<DialogResponse> {
    return this.handleCallback(
      this.makeBotContext(tgId, {
        callbackData: pressedCode(this, tgId, textContains),
      }),
    );
  }

  /** Нажатие готового сырого кода: штампуется актуальным штампом экрана. */
  async pressRaw(tgId: number, rawCode: string): Promise<DialogResponse> {
    return this.handleCallback(
      this.makeBotContext(tgId, {
        callbackData: stampedCode(this, tgId, rawCode),
      }),
    );
  }

  /**
   * Ждёт проактивное сообщение адресату (опрос `api.sentMessages`, 20 мс);
   * `contains` — фрагмент текста. Не найдено за таймаут — `undefined`.
   */
  async waitForMessage(
    tgId: number,
    opts: { contains?: string; timeoutMs?: number } = {},
  ): Promise<string | undefined> {
    const find = () =>
      this.api.sentMessages.find(
        (m) =>
          m.telegramId === tgId &&
          (opts.contains === undefined || m.text.includes(opts.contains)),
      );
    await waitUntil(() => find() !== undefined, opts.timeoutMs ?? 3000);
    return find()?.text;
  }

  /** Текст без «/» (ввод в ожидающий диалог или подсказка). */
  async sendText(tgId: number, text: string): Promise<DialogResponse> {
    return this.handleMessage(this.makeBotContext(tgId, { text }));
  }

  // ── События групп (F-02): через обработчики транспорта, как в main.ts ──

  /** Апдейт `chat_member`: идёт в `transport.handleChatMember`. */
  async chatMember(opts: {
    chatId: number | string;
    user: TgUser;
    oldStatus: ChatMemberStatus;
    newStatus: ChatMemberStatus;
  }): Promise<void> {
    const ctx = {
      chatMember: {
        chat: { id: opts.chatId, type: 'supergroup' },
        from: opts.user,
        old_chat_member: { status: opts.oldStatus, user: opts.user },
        new_chat_member: { status: opts.newStatus, user: opts.user },
      },
    } as unknown as BotContext;
    await this.transport.handleChatMember(ctx);
  }

  /** Апдейт `my_chat_member` (статус бота): идёт в `transport.handleMyChatMember`. */
  async myChatMember(opts: {
    chatId: number | string;
    from?: TgUser;
    oldStatus: ChatMemberStatus;
    newStatus: ChatMemberStatus;
  }): Promise<void> {
    const bot: TgUser = { id: 1, first_name: 'bot' };
    const ctx = {
      myChatMember: {
        chat: { id: opts.chatId, type: 'supergroup' },
        ...(opts.from ? { from: opts.from } : {}),
        old_chat_member: { status: opts.oldStatus, user: bot },
        new_chat_member: { status: opts.newStatus, user: bot },
      },
    } as unknown as BotContext;
    await this.transport.handleMyChatMember(ctx);
  }

  /** update_id последнего апдейта (`tg:<update_id>` — его correlationId). */
  get lastUpdateId(): number {
    return this.#updateSeq;
  }

  /**
   * Повторная доставка последнего апдейта — тот же контекст и `update_id`
   * (Telegram не дождался ответа). `sessionLost` — процесс упал после
   * исполнения апдейта, но до сохранения сессии: она возвращается к
   * состоянию до апдейта, и повтор проходит сверку штампа.
   */
  async redeliver(
    opts: { sessionLost?: boolean } = {},
  ): Promise<DialogResponse> {
    const last = this.#lastUpdate;
    if (!last) throw new Error('Апдейтов ещё не было');
    const tgId = last.ctx.from?.id;
    if (opts.sessionLost && tgId !== undefined && last.sessionBefore) {
      sessionsOf(this.transport).set(tgId, structuredClone(last.sessionBefore));
    }
    return this.#deliver(last.fn);
  }

  // ── Внутреннее ──

  /** Команда: подставляет текст в конверт и идёт через transport.handleCommand. */
  async #command(ctx: BotContext, text: string): Promise<DialogResponse> {
    (ctx as { message: unknown }).message = { text };
    return this.#run(ctx, () => this.transport.handleCommand(ctx));
  }

  /**
   * Обёртки на экземпляре uiApp: транспорт вызывает uiApp.handle* —
   * перехватываем возвращённый DialogResponse (последний за #run).
   */
  #captureResponses(): void {
    const ui = this.uiApp as unknown as Record<
      string,
      (...args: never[]) => Promise<DialogResponse | null>
    >;
    for (const key of ['handleCommand', 'handleCallback', 'handleMessage']) {
      const original = ui[key]?.bind(this.uiApp);
      if (!original) continue;
      ui[key] = async (...args: never[]) => {
        const response = await original(...args);
        const slot = this.#slot.getStore();
        if (slot) slot.response = response;
        return response;
      };
    }
  }

  /**
   * Запускает обработчик транспорта и возвращает DialogResponse,
   * захваченный на границе uiApp (полная форма: screen + notify +
   * awaitInput/release). {} — ответа не было (тихий пропуск).
   *
   * Каждый вызов — новый апдейт Telegram: мок-контекст получает свежий
   * `update_id` (контексты переиспользуются между нажатиями).
   */
  async #run(
    ctx: BotContext,
    fn: () => Promise<void>,
  ): Promise<DialogResponse> {
    (ctx as { update: unknown }).update = { update_id: ++this.#updateSeq };
    const tgId = ctx.from?.id;
    const session =
      tgId === undefined ? undefined : sessionsOf(this.transport).get(tgId);
    this.#lastUpdate = {
      ctx,
      fn,
      sessionBefore: session && structuredClone(session),
    };
    return this.#deliver(fn);
  }

  async #deliver(fn: () => Promise<void>): Promise<DialogResponse> {
    const slot: { response: DialogResponse | null } = { response: null };
    await this.#slot.run(slot, fn);
    return slot.response ?? {};
  }
}

/**
 * Создаёт TestBotTransport из TestApp (стандартные фикстуры).
 * Использует общую с apiApp шину событий — проактивные сценарии работают.
 */
export function createTestBotTransport(
  app: TestApp,
  controllers: U7BotController[],
): TestBotTransport {
  return new TestBotTransport(
    app.apiApp,
    (tgId) => app.userByTelegramId(tgId),
    controllers,
    {
      eventBus: app.eventBus,
      callers: app.callers,
    },
  );
}

// ── Хелперы отштампованных нажатий (integration/e2e) ──

/**
 * Приватная мапа сессий BotTransport — тестовый доступ для dialogOf/
 * dropSession (обход private как в #captureResponses: стенд уже работает
 * с внутренностями транспорта через приведение типов).
 */
function sessionsOf(transport: BotTransport): Map<number, BotSession> {
  return (transport as unknown as { sessions: Map<number, BotSession> })
    .sessions;
}

/** Экран в хронологии отображения: sent или edit (text + keyboard). */
interface ScreenRecord {
  text: string;
  keyboard?: KeyboardDescription;
}

/**
 * Экраны пользователя в порядке отображения (новые первее).
 *
 * Api-записи ведут два массива (sent/edited); edit рендерит СУЩЕСТВУЮЩЕЕ
 * сообщение (messageId оригинала), поэтому хронология восстанавливается
 * так: sent-ы по порядку, каждый edit — сразу за своим sent. Простая
 * склейка [...edited, ...sent] даёт неверный порядок, когда edit-экраны
 * (drill-down одной стори — seq не растёт, рендер edit'ом) чередуются
 * с send-экранами (смена стори).
 */
export function screensNewFirst(
  transport: TestBotTransport,
  tgId: number,
): ScreenRecord[] {
  const editsByMessageId = new Map<number, ScreenRecord[]>();
  for (const e of transport.api.editedMessages) {
    if (e.telegramId !== tgId) continue;
    const list = editsByMessageId.get(e.messageId) ?? [];
    list.push(e);
    editsByMessageId.set(e.messageId, list);
  }
  const merged: ScreenRecord[] = [];
  for (const s of transport.api.sentMessages) {
    if (s.telegramId !== tgId) continue;
    merged.push(s);
    merged.push(...(editsByMessageId.get(s.messageId) ?? []));
  }
  return merged.reverse();
}

/**
 * Отштампованный код кнопки с последнего экрана пользователя (Api-запись).
 * Перед нажатием экран должен быть открыт (/start или предыдущая кнопка).
 */
export function pressedCode(
  transport: TestBotTransport,
  tgId: number,
  textContains: string,
): string {
  for (const screen of screensNewFirst(transport, tgId)) {
    const btn = screen.keyboard?.rows
      .flat()
      .find((b) => b.text.includes(textContains));
    if (btn) return btn.code;
  }
  throw new Error(
    `Кнопка «${textContains}» не найдена на экранах ${tgId} ` +
      `(перед нажатием открой экран через /start или кнопку).`,
  );
}

/**
 * Штамп текущего экрана пользователя (последний сегмент `:~seq36`).
 * Транспорт валидирует штамп на входе — крафтовый код прямого вызова
 * стори должен нести актуальный штамп открытого экрана.
 */
export function currentStamp(
  transport: TestBotTransport,
  tgId: number,
): string {
  for (const screen of screensNewFirst(transport, tgId)) {
    const btn = screen.keyboard?.rows.flat()[0];
    if (!btn) continue;
    const stamp = btn.code.split(':').pop();
    if (stamp?.startsWith('~')) return stamp;
  }
  throw new Error(`Нет открытого экрана у ${tgId} — сначала /start`);
}

/**
 * Сырой код, отштампованный актуальным штампом экрана — для прямых
 * вызовов стори через транспорт (integration): коды с UUID, созданными
 * в тесте, неоткуда взять с экрана — штампуем вручную.
 */
export function stampedCode(
  transport: TestBotTransport,
  tgId: number,
  rawCode: string,
): string {
  return `${rawCode}:${currentStamp(transport, tgId)}`;
}
