import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  AppException,
  errAccessDenied,
  errBadRequest,
  errConflict,
  errInternal,
  errNotFound,
  errUnauthorized,
  errValidation,
} from '@u7-scl/core/domain';
import {
  assertMarkdownV2Safe,
  type Logger,
  LogLevel,
  type MdText,
  md,
  setGlobalLogger,
} from '@u7-scl/core/shared';
import {
  BotRequestContext,
  type BotSession,
  type BotUpdate,
  type CommandUpdate,
  type DialogResponse,
} from '@u7-scl/core/ui';
import {
  GetUsersByIdsUcDef,
  GetUserUcDef,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import {
  ListUserWishesUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import {
  type AnyModuleDef,
  type Caller,
  type Command,
  CoreErrors,
  type DomainError,
  GuestCaller,
  ok,
  type Result,
} from 'dmg-core';
import type { Trace } from 'dmg-core/app';
import { APP_CODES } from '../shared/app-codes';
import type { U7BotActor } from './u7-bot-app-meta';
import { U7BotController } from './u7-bot-controller';
import { U7BotUiStory } from './u7-bot-ui-story';
import { userActor } from './user-actor.test-kit';

/**
 * Заглушка для доступа к protected методу handleError.
 */
class TestStory extends U7BotUiStory {
  readonly name = 'test-handle-error';

  override handleMessage(
    _update: BotUpdate,
    _actor: U7BotActor,
    _session: BotSession,
  ): Promise<DialogResponse> {
    throw new Error('Method not implemented.');
  }

  handleCallback(): Promise<DialogResponse> {
    throw new Error('Не используется');
  }

  /** Экспонируем protected handleError */
  testHandleError(err: unknown): DialogResponse {
    return this.handleError(err);
  }

  /** Экспонируем protected unknownCommand (ветка внутри стори). */
  testUnknownCommand(action: string): DialogResponse {
    return this.unknownCommand(action, actor, {
      dialog: { path: 'c/test-handle-error', seq: 1 },
    });
  }
}

const actor = userActor({
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Тест',
  telegramId: 1,
  roles: ['GUEST'],
});

/** Создаёт мок-логгер */
function createMockLogger(): Logger & { error: ReturnType<typeof mock> } {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    setLogLevel: mock(() => {}),
    getLogLevel: mock(() => LogLevel.DEBUG),
    setSourceLevel: mock(() => {}),
  } as unknown as Logger & { error: ReturnType<typeof mock> };
}

describe('U7BotUiStory.unknownCommand — мета warn', () => {
  test('в мете — проекция актора (kind + subjectId), а не субъект целиком', () => {
    const warns: Array<Record<string, unknown> | undefined> = [];
    setGlobalLogger({
      debug() {},
      info() {},
      warn(_source, _message, meta) {
        warns.push(meta);
      },
      error() {},
      setLogLevel() {},
      getLogLevel() {
        return 0;
      },
      setSourceLevel() {},
    });
    const story = new TestStory();

    story.testUnknownCommand('boom');

    const meta = warns[0];
    expect(meta?.actor).toEqual({
      kind: 'user',
      subjectId: actor.user.uuid,
    });
    expect(JSON.stringify(meta).length).toBeLessThan(500);
    setGlobalLogger(undefined as unknown as Logger);
  });
});

describe('U7BotUiStory.handleError', () => {
  let story: TestStory;
  let mockLogger: Logger & { error: ReturnType<typeof mock> };

  beforeEach(() => {
    story = new TestStory();
    mockLogger = createMockLogger();
    setGlobalLogger(mockLogger);
  });

  afterEach(() => {
    // Сбрасываем глобальный логгер, чтобы не влиять на другие тесты
  });

  describe('validation error', () => {
    test('возвращает экран с перечислением полей', () => {
      const appError = errValidation(
        'CreateStreamValidationError',
        'Ошибка валидации',
        {
          issues: [
            { path: 'title', message: 'Обязательное поле' },
            { path: 'startDate', message: 'Некорректный формат даты' },
          ],
        },
      );
      const exception = new AppException(appError);

      const resp = story.testHandleError(exception);

      expect(resp.screen).toBeDefined();
      expect(String(resp.screen!.text)).toContain('title');
      expect(String(resp.screen!.text)).toContain('startDate');
      expect(String(resp.screen!.text)).toContain('Обязательное поле');
      expect(String(resp.screen!.text)).toContain('Некорректный формат даты');
    });

    test('валидация без issues — показывает общее сообщение', () => {
      const appError = errValidation(
        'GenericValidationError',
        'Что-то не так',
        undefined as unknown as Record<string, unknown>,
      );
      const exception = new AppException(appError);

      const resp = story.testHandleError(exception);

      expect(resp.screen).toBeDefined();
      expect(String(resp.screen!.text)).toContain('Что\\-то не так');
    });
  });

  describe('not-found error', () => {
    test('возвращает экран ошибки', () => {
      const exception = new AppException(
        errNotFound('ModuleNotFound', 'Модуль не найден', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(String(resp.screen!.text)).toContain('Модуль не найден');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('conflict error', () => {
    test('возвращает экран ошибки', () => {
      const exception = new AppException(
        errConflict('StreamAlreadyExists', 'Поток уже существует', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(String(resp.screen!.text)).toContain('Поток уже существует');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('access-denied error', () => {
    test('возвращает экран ошибки', () => {
      const exception = new AppException(
        errAccessDenied('AccessDenied', 'Недостаточно прав', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(String(resp.screen!.text)).toContain('Недостаточно прав');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('bad-request error', () => {
    test('возвращает экран ошибки', () => {
      const exception = new AppException(
        errBadRequest('BadRequest', 'Некорректный запрос', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(String(resp.screen!.text)).toContain('Некорректный запрос');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('internal error', () => {
    test('логирует и возвращает общий экран', () => {
      const exception = new AppException(
        errInternal('ServerError', 'Внутренняя ошибка сервера', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(String(resp.screen!.text)).toContain('внутренняя ошибка');
      expect(String(resp.screen!.text)).not.toContain(
        'Внутренняя ошибка сервера',
      );
    });
  });

  describe('unauthorized error', () => {
    test('логирует и возвращает общий экран', () => {
      const exception = new AppException(
        errUnauthorized('Unauthorized', 'Не авторизован'),
      );

      const resp = story.testHandleError(exception);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(String(resp.screen!.text)).not.toContain('Не авторизован');
    });
  });

  describe('обычный Error (не AppException)', () => {
    test('логирует и возвращает общий экран', () => {
      const err = new Error('Что-то пошло не так');

      const resp = story.testHandleError(err);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(String(resp.screen!.text)).toContain('внутренняя ошибка');
      expect(String(resp.screen!.text)).not.toContain('Что-то пошло не так');
    });
  });

  describe('неизвестный тип ошибки', () => {
    test('логирует и возвращает общий экран', () => {
      const resp = story.testHandleError('странная строка');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(String(resp.screen!.text)).toContain('внутренняя ошибка');
    });
  });

  // Инцидент 2026-09-03: неэкранированная точка в fallback-тексте внутренней ошибки
  // роняла MarkdownV2-валидатор → сообщение об ошибке не отправлялось вовсе.
  // Новый контракт: MdText-тексты, валидируются транспортом (assertDialogResponseMarkdownSafe).
  describe('MarkdownV2-безопасность текста', () => {
    test('internal: fallback-текст проходит assertMarkdownV2Safe', () => {
      const exception = new AppException(
        errInternal('ServerError', 'Внутренняя ошибка сервера', undefined),
      );

      const resp = story.testHandleError(exception);

      expect(() => assertMarkdownV2Safe(resp.screen!.text)).not.toThrow();
    });

    test('validation с issues: path и message с точками/скобками экранированы', () => {
      const appError = errValidation('ValidationError', 'Ошибка валидации', {
        issues: [
          { path: 'title', message: 'Поле "title" обязательно (см. пример).' },
          {
            path: 'startDate',
            message: 'Некорректный формат даты [дд.мм.гггг]',
          },
        ],
      });
      const exception = new AppException(appError);

      const resp = story.testHandleError(exception);

      expect(() => assertMarkdownV2Safe(resp.screen!.text)).not.toThrow();
    });

    test('validation без issues: message с точкой проходит assertMarkdownV2Safe', () => {
      const exception = new AppException(
        errValidation(
          'GenericValidationError',
          'Некорректное значение поля (см. инструкцию).',
          undefined as unknown as Record<string, unknown>,
        ),
      );

      const resp = story.testHandleError(exception);

      expect(() => assertMarkdownV2Safe(resp.screen!.text)).not.toThrow();
    });
  });

  describe('наследник U7BotUiStory', () => {
    test('menuButtons по умолчанию — пусто (стори не участвует в меню)', async () => {
      const s = new TestStory();
      expect(await s.menuButtons(actor)).toEqual([]);
    });

    test('menuButtons — асинхронный контракт Promise<MenuButton[]> (ФР-7)', () => {
      const s = new TestStory();
      expect(s.menuButtons(actor)).toBeInstanceOf(Promise);
    });

    test('экран ошибки содержит кнопку «⬅️ Меню» с кодом из APP_CODES (§10.20)', () => {
      const resp = story.testHandleError(
        new AppException(
          errNotFound('ModuleNotFound', 'Модуль не найден', undefined),
        ),
      );

      expect(resp.screen?.keyboard?.rows).toEqual([
        [{ text: '⬅️ Меню', code: APP_CODES.mainMenu }],
      ]);
    });
  });
});

// ── Кнопки выхода на экранах ошибок прикладного слоя (§10.20) ──

describe('U7BotController — errorExitRows (§10.20)', () => {
  /** Стори, кидающая ошибку из callback — контроллер построит экран ошибки. */
  class ThrowingStory extends U7BotUiStory {
    readonly name = 'boom';

    override handleCallback(): Promise<DialogResponse> {
      throw new AppException(
        errNotFound('StreamNotFound', 'Поток не найден', undefined),
      );
    }
  }

  class ThrowingController extends U7BotController {
    readonly name = 'streams';

    constructor(story: U7BotUiStory) {
      super();
      this.stories.push(story);
    }
  }

  test('экран ошибки контроллера содержит кнопку «⬅️ Меню» с кодом из APP_CODES', async () => {
    setGlobalLogger(createMockLogger());
    const ctrl = new ThrowingController(new ThrowingStory());
    ctrl.init({
      appApi: {} as never,
      eventBus: {} as never,
      actorResolver: async () => actor,
    } as never);

    const resp = await ctrl.handleCallback('boom:open', actor, {
      dialog: { path: 'streams/boom', seq: 1 },
    });

    expect(String(resp.screen?.text)).toContain('Поток не найден');
    expect(resp.screen?.keyboard?.rows).toEqual([
      [{ text: '⬅️ Меню', code: APP_CODES.mainMenu }],
    ]);
  });
});

// ── Контракт команд u7-стори (ФР-4) ──

describe('U7BotUiStory — контракт handleCommand', () => {
  /** Стори с контекстной справкой и счётчиком сброса. */
  class ContractStory extends U7BotUiStory {
    readonly name = 'fill';
    resetCalls = 0;
    help: MdText | null = null;

    override reset(): void {
      this.resetCalls++;
    }

    override handleCallback(): Promise<DialogResponse> {
      throw new Error('Не используется');
    }
    // handleMessage не переопределена — дефолт ядра (реплика-отказ)
    override async contextHelp(): Promise<MdText | null> {
      return this.help;
    }
  }

  class ContractController extends U7BotController {
    readonly name = 'questionnaire';

    constructor(story: U7BotUiStory) {
      super();
      this.stories.push(story);
    }
  }

  /** Инициализированная пара контроллер+стори (dialogPath = ctrl/story). */
  function makeStory(): ContractStory {
    const story = new ContractStory();
    const ctrl = new ContractController(story);
    ctrl.init({
      appApi: {} as never,
      eventBus: {} as never,
      actorResolver: async () => actor,
    } as never);
    return story;
  }

  function cmd(command: string): CommandUpdate {
    return { type: 'command', command, args: '', telegramId: 1 };
  }

  const activeSession: BotSession = {
    dialog: { path: 'questionnaire/fill', seq: 2 },
  };
  const otherSession: BotSession = { dialog: { path: 'app/menu', seq: 2 } };

  test('dialogPath вычисляется из контроллера и имени стори', () => {
    const story = makeStory();
    expect(story.dialogPath).toBe('questionnaire/fill');
  });

  test('isActive: свой диалог — true, чужой/закрытый — false', () => {
    const story = makeStory();
    expect(story.isActive(activeSession)).toBe(true);
    expect(story.isActive(otherSession)).toBe(false);
    expect(story.isActive({} as BotSession)).toBe(false);
  });

  test('/start → исключение-сторож: команда обрабатывается uiApp, до стори не доходит', async () => {
    const story = makeStory();
    await expect(
      story.handleCommand(cmd('start'), actor, activeSession),
    ).rejects.toThrow();
  });

  test('/help → pass: команда обрабатывает uiApp, до pipe не доходит', async () => {
    const story = makeStory();
    story.help = md`Справка анкеты`;

    const reaction = await story.handleCommand(
      cmd('help'),
      actor,
      activeSession,
    );

    // Ни активная, ни неактивная стори в /help не вовлечены — даже со справкой
    expect(reaction).toEqual({ reaction: 'pass' });
  });

  test('contextHelp по умолчанию — null (uiApp уйдёт в общий help)', async () => {
    class BareStory extends U7BotUiStory {
      readonly name = 'bare';
      override handleCallback(): Promise<DialogResponse> {
        throw new Error('Не используется');
      }
    }
    const bare = new BareStory();

    expect(await bare.contextHelp(actor, activeSession)).toBeNull();
  });

  test('/cancel активна → сброс себя + stop{notify: «Отменено. Наберите /start»}', async () => {
    const story = makeStory();

    const reaction = await story.handleCommand(
      cmd('cancel'),
      actor,
      activeSession,
    );

    expect(story.resetCalls).toBe(1);
    expect(reaction.reaction).toBe('stop');
    if (reaction.reaction === 'stop') {
      expect(String(reaction.response.notify?.text)).toContain('Отменено');
      // MarkdownV2-безопасность дефолтного текста
      expect(() =>
        assertMarkdownV2Safe(reaction.response.notify?.text ?? ''),
      ).not.toThrow();
    }
  });

  test('/cancel неактивна → pass без побочных действий (сброс только активной)', async () => {
    const story = makeStory();

    const reaction = await story.handleCommand(
      cmd('cancel'),
      actor,
      otherSession,
    );

    expect(story.resetCalls).toBe(0);
    expect(reaction).toEqual({ reaction: 'pass' });
  });

  test('прочая команда → pass (домен реагирует только своими командами)', async () => {
    const story = makeStory();

    const reaction = await story.handleCommand(
      cmd('tasks'),
      actor,
      activeSession,
    );

    expect(reaction).toEqual({ reaction: 'pass' });
  });
});

// ── Вызов UC DMG от имени актора бота: команда модулю по Def (D-49) ──

describe('U7BotUiStory.dispatchUc', () => {
  type Sent = {
    module: AnyModuleDef;
    command: Command;
    caller: Caller;
    trace: Trace;
  };

  class UcStory extends U7BotUiStory {
    readonly name = 'wish';

    override handleCallback(): Promise<DialogResponse> {
      throw new Error('Не используется');
    }

    list() {
      return this.dispatchUc(
        WishModuleDef,
        ListUserWishesUcDef.command({}),
        actor,
      );
    }
  }

  /** Запрос резолвера `Caller`: идентичность и след вызова. */
  type Resolved = { uuid: string | undefined; trace: Trace };

  /**
   * Story над приложением, `dispatch` которого отвечает `answer`; резолвер
   * `Caller` приложения находит актора и записывает запросы в `resolved`.
   */
  function makeStory(
    sent: Sent[],
    answer: Result<unknown, DomainError>,
    resolved: Resolved[] = [],
  ) {
    const dispatch = async (
      module: AnyModuleDef,
      command: Command,
      caller: Caller,
      trace: Trace,
    ) => {
      sent.push({ module, command, caller, trace });
      return answer;
    };
    const callers = {
      resolve: async (uuid: string | undefined, trace: Trace) => {
        resolved.push({ uuid, trace });
        throw new Error('callers.resolve не должен вызываться для актора');
      },
    };
    const story = new UcStory();
    story.init({
      appApi: { dispatch },
      eventBus: {},
      actorResolver: async () => actor,
      callers,
    } as never);
    return story;
  }

  test('команда модулю wish: субъект — актор, след — запрос канала telegram', async () => {
    const sent: Sent[] = [];
    setGlobalLogger(createMockLogger());

    expect(await makeStory(sent, ok([])).list()).toEqual(ok([]));

    const [call] = sent;
    if (call === undefined) throw new Error('Команда не отправлена');
    expect(call.module).toBe(WishModuleDef);
    expect(call.command).toEqual(ListUserWishesUcDef.command({}));
    expect(call.caller).toBe(actor);
    expect(call.trace.cause.kind).toBe('request');
    expect(call.trace.channel).toEqual({ name: 'telegram', visitorId: '1' });
  });

  test('caller — сам актор: без повторного резолва по uuid', async () => {
    const sent: Sent[] = [];
    const resolved: Resolved[] = [];
    setGlobalLogger(createMockLogger());

    await makeStory(sent, ok([]), resolved).list();

    expect(sent[0]?.caller).toBe(actor);
    expect(resolved).toHaveLength(0);
  });

  test('отказ UC — значение Err, не исключение', async () => {
    const denied = CoreErrors.ACCESS_DENIED.err({
      rule: 'isOwner',
      denyMessage: 'Нет',
    });

    expect(await makeStory([], denied).list()).toEqual(denied);
  });

  test('requestId транспорт не передаёт — создаётся новый на вызов с warn', async () => {
    const sent: Sent[] = [];
    const logger = createMockLogger();
    setGlobalLogger(logger);
    const story = makeStory(sent, ok([]));

    await story.list();
    await story.list();

    const ids = sent.map((c) => c.trace.correlationId);
    expect(new Set(ids).size).toBe(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  test('в контексте апдейта: requestId — tg:<update_id>#<n>, correlationId общий, без warn', async () => {
    const sent: Sent[] = [];
    const logger = createMockLogger();
    setGlobalLogger(logger);
    const story = makeStory(sent, ok([]));

    await BotRequestContext.run(100, async () => {
      await story.list();
      await story.list();
    });

    expect(sent.map((c) => c.trace.clientRequestId)).toEqual([
      'tg:100#1',
      'tg:100#2',
    ]);
    expect(sent.map((c) => c.trace.correlationId)).toEqual([
      'tg:100',
      'tg:100',
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('повтор апдейта — те же requestId (отсев повторов узнаёт команду)', async () => {
    const sent: Sent[] = [];
    setGlobalLogger(createMockLogger());
    const story = makeStory(sent, ok([]));

    await BotRequestContext.run(7, () => story.list());
    await BotRequestContext.run(7, () => story.list());

    expect(sent.map((c) => c.trace.clientRequestId)).toEqual([
      'tg:7#1',
      'tg:7#1',
    ]);
  });
});

// ── Профили пользователей: findUser / findUsers (Def модуля user) ──

describe('U7BotUiStory.findUser / findUsers', () => {
  const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
  const OTHER_ID = '33333333-3333-4333-8333-333333333333';

  const profile = (uuid: string): UserView => ({
    uuid,
    name: `Имя ${uuid.slice(0, 2)}`,
    telegramId: 10,
    roles: ['GUEST'],
    createdAt: 1,
    updatedAt: 1,
    version: 0,
  });

  type Sent = { module: AnyModuleDef; command: Command; caller: Caller };

  class ProfileStory extends U7BotUiStory {
    readonly name = 'profiles';

    override handleCallback(): Promise<DialogResponse> {
      throw new Error('Не используется');
    }

    one(uuid: string, as?: U7BotActor) {
      return this.findUser(uuid, as);
    }

    many(uuids: string[], as?: U7BotActor) {
      return this.findUsers(uuids, as);
    }
  }

  /** Story над `dispatch`, который отвечает `answer`; резолвер запоминает uuid. */
  function makeStory(
    answer: (command: Command) => Result<unknown, DomainError>,
    sent: Sent[] = [],
  ) {
    const story = new ProfileStory();
    story.init({
      appApi: {
        dispatch: async (
          module: AnyModuleDef,
          command: Command,
          caller: Caller,
        ) => {
          sent.push({ module, command, caller });
          return answer(command);
        },
      },
      eventBus: {},
      actorResolver: async () => actor,
      callers: {
        resolve: async () => new GuestCaller(),
      },
    } as never);
    return story;
  }

  const notFound = () =>
    ({
      ok: false,
      error: { code: 'USER_NOT_FOUND', kind: 'not_found', label: 'Нет' },
    }) as unknown as Result<unknown, DomainError>;

  const failure = () =>
    ({
      ok: false,
      error: { code: 'CORE_INTERNAL', kind: 'internal', label: 'Сбой' },
    }) as unknown as Result<unknown, DomainError>;

  test('findUser: найден — профиль, команда getUser модулю user', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    const story = makeStory(() => ok(profile(PROFILE_ID)), sent);

    expect(await story.one(PROFILE_ID, actor)).toEqual(profile(PROFILE_ID));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.module).toBe(UserModuleDef);
    expect(sent[0]?.command).toEqual(
      GetUserUcDef.command({ uuid: PROFILE_ID }),
    );
  });

  test('findUser: USER_NOT_FOUND — undefined', async () => {
    setGlobalLogger(createMockLogger());
    expect(await makeStory(notFound).one(PROFILE_ID, actor)).toBeUndefined();
  });

  test('findUser: прочий Err — исключение с кодом', async () => {
    setGlobalLogger(createMockLogger());
    await expect(makeStory(failure).one(PROFILE_ID, actor)).rejects.toThrow(
      'CORE_INTERNAL',
    );
  });

  test('findUser: исключение dispatch не глотается', async () => {
    setGlobalLogger(createMockLogger());
    const story = makeStory(() => {
      throw new Error('диск недоступен');
    });
    await expect(story.one(PROFILE_ID, actor)).rejects.toThrow(
      'диск недоступен',
    );
  });

  test('findUser: с актором caller — сам актор', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    await makeStory(() => ok(profile(PROFILE_ID)), sent).one(PROFILE_ID, actor);
    expect(sent[0]?.caller).toBe(actor);
  });

  test('findUser: без актора — GuestCaller', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    await makeStory(() => ok(profile(PROFILE_ID)), sent).one(PROFILE_ID);
    expect(sent[0]?.caller).toBeInstanceOf(GuestCaller);
  });

  test('findUsers: команда getUsersByIds, результат — профили', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    const story = makeStory(
      () => ok([profile(PROFILE_ID), profile(OTHER_ID)]),
      sent,
    );

    const users = await story.many([PROFILE_ID, OTHER_ID], actor);

    expect(users.map((u) => u.uuid)).toEqual([PROFILE_ID, OTHER_ID]);
    expect(sent[0]?.module).toBe(UserModuleDef);
    expect(sent[0]?.command).toEqual(
      GetUsersByIdsUcDef.command({ userIds: [PROFILE_ID, OTHER_ID] }),
    );
  });

  test('findUsers: пустой вход — [] без вызова dispatch', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    const story = makeStory(() => ok([]), sent);

    expect(await story.many([])).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  test('findUsers: Err — исключение с кодом', async () => {
    setGlobalLogger(createMockLogger());
    await expect(makeStory(failure).many([PROFILE_ID], actor)).rejects.toThrow(
      'CORE_INTERNAL',
    );
  });

  test('findUsers: без актора — GuestCaller, с актором — сам актор', async () => {
    setGlobalLogger(createMockLogger());
    const sent: Sent[] = [];
    const story = makeStory(() => ok([]), sent);
    await story.many([PROFILE_ID]);
    await story.many([PROFILE_ID], actor);
    expect(sent[0]?.caller).toBeInstanceOf(GuestCaller);
    expect(sent[1]?.caller).toBe(actor);
  });

  test('мост subjectOf удалён: актор сам субъект', () => {
    expect('subjectOf' in U7BotUiStory.prototype).toBe(false);
  });
});
