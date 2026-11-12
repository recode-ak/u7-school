import { describe, expect, test } from 'bun:test';
import {
  CoreErrors,
  type DomainError,
  ErrorDef,
  GuestCaller,
  type PersonCaller,
  UserCaller,
} from 'dmg-core';
import type { Logger } from '../../shared/logger';
import { setGlobalLogger } from '../../shared/logger';
import { md, type mdRaw } from '../../shared/markdown';
import { assertMarkdownV2Safe } from '../../shared/markdown-validator';
import { BotUiStory } from './bot-ui-story';
import {
  ask,
  btn,
  btnUrl,
  go,
  type KbButton,
  kb,
  note,
  notify,
  screen,
  warn,
} from './response-builders';
import type {
  BotSession,
  BotUpdate,
  DialogResponse,
  KeyboardDescription,
} from './types';

/** Актор UI — `PersonCaller` (ограничение `TActor` платформы). */
type TestActor = PersonCaller;

/** Логгер-шпион warn-вызовов (остальное — молчаливые заглушки). */
function makeWarnSpyLogger(
  warns: Array<[string, string, Record<string, unknown> | undefined]>,
): Logger {
  return {
    debug() {},
    info() {},
    warn(source, message, meta) {
      warns.push([source, message, meta]);
    },
    error() {},
    setLogLevel() {},
    getLogLevel() {
      return 0;
    },
    setSourceLevel() {},
  };
}

/** Логгер-шпион error-вызовов (остальное — молчаливые заглушки). */
function makeErrorSpyLogger(errors: unknown[]): Logger {
  return {
    debug() {},
    info() {},
    warn() {},
    error(_source, _message, meta) {
      errors.push(meta);
    },
    setLogLevel() {},
    getLogLevel() {
      return 0;
    },
    setSourceLevel() {},
  };
}

/** Стори-заглушка: открывает protected API (confirm/handleError). */
class TestStory extends BotUiStory<TestActor> {
  readonly name = 'anketa';

  override async handleCallback(
    _action: string,
    _actor: TestActor,
    _session: BotSession,
  ): Promise<DialogResponse> {
    return {};
  }
  // handleMessage НЕ переопределена: наследуем дефолт ядра (реплика-отказ)

  // Экспонирование protected для тестов
  callConfirm(
    action: string,
    targetId: string,
    text: ReturnType<typeof mdRaw>,
    opts?: Parameters<TestStory['confirm']>[3],
  ): ReturnType<TestStory['confirm']> {
    return this.confirm(action, targetId, text, opts);
  }
  callHandleError(err: unknown): ReturnType<TestStory['handleError']> {
    return this.handleError(err);
  }
  callErrorNotify(err: unknown): ReturnType<TestStory['errorNotify']> {
    return this.errorNotify(err);
  }
  callUcErrorNotify(error: DomainError): ReturnType<TestStory['errorNotify']> {
    return this.ucErrorNotify(error);
  }
  callCb(action: string, ...ids: string[]): string {
    return this.cb(action, ...ids);
  }
  callCbFor(story: string, action: string, ...ids: string[]): string {
    return this.cbFor(story, action, ...ids);
  }
  callStripPrefix(data: string): string {
    return this.stripPrefix(data);
  }
  callUnknownCommand(
    action: string,
    actor: TestActor,
    session: BotSession,
  ): ReturnType<TestStory['unknownCommand']> {
    return this.unknownCommand(action, actor, session);
  }
  callFormatDate(iso: string): string {
    return this.formatDate(iso);
  }
  // Делегаты билдеров ответов (ФР-2) — экспонирование для тестов
  callScreen(
    text: ReturnType<typeof mdRaw>,
    keyboard?: KeyboardDescription,
  ): ReturnType<BotUiStory<TestActor>['screen']> {
    return this.screen(text, keyboard);
  }
  callAsk(
    text: ReturnType<typeof mdRaw>,
    context: unknown,
    keyboard?: KeyboardDescription,
  ): ReturnType<BotUiStory<TestActor>['ask']> {
    return this.ask(text, context, keyboard);
  }
  callWarn(
    text: ReturnType<typeof mdRaw>,
  ): ReturnType<BotUiStory<TestActor>['warn']> {
    return this.warn(text);
  }
  callNotify(
    text: ReturnType<typeof mdRaw>,
  ): ReturnType<BotUiStory<TestActor>['notify']> {
    return this.notify(text);
  }
  callNote(
    text: ReturnType<typeof mdRaw>,
  ): ReturnType<BotUiStory<TestActor>['note']> {
    return this.note(text);
  }
  callGo(path: string): ReturnType<BotUiStory<TestActor>['go']> {
    return this.go(path);
  }
  callKb(
    rows: KbButton[][],
    opts?: { multiple?: boolean },
  ): ReturnType<BotUiStory<TestActor>['kb']> {
    return this.kb(rows, opts);
  }
  callBtn(text: string, code: string): KbButton {
    return this.btn(text, code);
  }
  callBtnUrl(text: string, url: string): KbButton {
    return this.btnUrl(text, url);
  }
}

describe('BotUiStory — confirm', () => {
  test('строит confirm-экран: кнопки подтверждения и отмены с кодами', () => {
    const story = new TestStory();

    const response = story.callConfirm(
      'complete',
      'uuid-123',
      md`Завершить шаг?`,
    );

    const row = response.screen?.keyboard?.rows[0];
    expect(row?.length).toBe(2);
    expect(row?.[0]).toEqual({
      text: '✅ Да',
      code: 'anketa:complete-confirm:uuid-123',
    });
    expect(row?.[1]).toEqual({
      text: '❌ Отмена',
      code: 'anketa:detail:uuid-123',
    });
    expect(String(response.screen?.text)).toBe('Завершить шаг?');
    expect(response.screen?.keyboard?.isMultiple).toBe(false);
  });

  test('опции: custom-кнопки, cancelCode, extraData', () => {
    const story = new TestStory();

    const response = story.callConfirm('remove', 'id-9', md`Точно?`, {
      confirmButton: '🔥 Снять',
      cancelButton: '◀️ Назад к списку',
      cancelCode: 'anketa:list',
      extraData: 'force',
    });

    const row = response.screen?.keyboard?.rows[0];
    expect(row?.[0]).toEqual({
      text: '🔥 Снять',
      code: 'anketa:remove-confirm:id-9:force',
    });
    expect(row?.[1]).toEqual({ text: '◀️ Назад к списку', code: 'anketa:list' });
  });

  test('confirm-текст — валидный MarkdownV2 с доменными данными', () => {
    const story = new TestStory();
    const dangerous = 'Имя с *спец*символами _и_ [скобками]';

    const response = story.callConfirm('act', 'id', md`Удалить ${dangerous}?`);

    // интерполяция экранирована: литерал целиком валиден
    expect(() =>
      assertMarkdownV2Safe(response.screen?.text ?? ''),
    ).not.toThrow();
    expect(String(response.screen?.text)).toContain(
      'Имя с \\*спец\\*символами',
    );
  });
});

describe('BotUiStory — дефолты контракта команд (ФР-4, pipe)', () => {
  // Ядро имён команд не знает: именных обработчиков нет,
  // дефолт на любую команду — pass («не моё»).
  test("handleCommand по умолчанию: любая команда → {reaction: 'pass'}", async () => {
    const story = new TestStory();

    for (const command of ['cancel', 'help', 'start', 'tasks']) {
      const reaction = await story.handleCommand(
        { type: 'command', command, args: '', telegramId: 7 },
        new GuestCaller(),
        { dialog: { path: 'x/y', seq: 1 } },
      );
      expect(reaction).toEqual({ reaction: 'pass' });
    }
  });

  test('handleMessage по умолчанию: warn + реплика-отказ + release (самоликвидация зависшего ввода)', async () => {
    const warns: Array<[string, string, Record<string, unknown> | undefined]> =
      [];
    setGlobalLogger(makeWarnSpyLogger(warns));
    const story = new TestStory();
    const update: BotUpdate = {
      type: 'message',
      text: 'привет',
      telegramId: 7,
    };

    const response = await story.handleMessage(update, new GuestCaller(), {
      dialog: { path: 'x/anketa', seq: 3, input: {} },
    });

    // Недостижимый при корректной стори путь — warn разработчику...
    expect(warns.length).toBe(1);
    expect(warns[0]?.[1]).toContain('handleMessage');
    expect(warns[0]?.[2]).toMatchObject({
      story: 'anketa',
      dialogPath: 'x/anketa',
    });
    // ...и явная реплика пользователю (экран не трогает) + release:
    // контекст ввода сброшен, пользователь выведен из зависшего ожидания
    expect(Object.keys(response)).toEqual(['notify', 'release']);
    expect(response.release).toBe(true);
    expect(String(response.notify?.text)).toBe(
      'Извините, на данном этапе сообщения не принимаются\\.',
    );
    setGlobalLogger(undefined as unknown as Logger);
  });
});

describe('BotUiStory — errorExitRows (кнопки выхода на экранах ошибок, §10.20)', () => {
  /** Стори с кнопкой выхода на экранах ошибок. */
  class ExitStory extends TestStory {
    protected override errorExitRows(): { text: string; code: string }[][] {
      return [[{ text: '⬅️ Меню', code: 'app:main-menu' }]];
    }
  }

  test('хук подставляет кнопки на экран ошибки (internal)', () => {
    const story = new ExitStory();

    const response = story.callHandleError(new Error('boom'));

    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: '⬅️ Меню', code: 'app:main-menu' }],
    ]);
    expect(response.screen?.keyboard?.isMultiple).toBe(false);
    expect(() =>
      assertMarkdownV2Safe(String(response.screen?.text)),
    ).not.toThrow();
  });

  test('без переопределения — экраны ошибок без клавиатуры, по умолчанию', () => {
    const story = new TestStory();

    const response = story.callHandleError(new Error('boom'));

    expect(response.screen?.keyboard).toBeUndefined();
  });
});

describe('BotUiStory — errorNotify (ФР-5)', () => {
  test('internal → общее сообщение, доменные данные не утекают, error-лог', () => {
    const errors: unknown[] = [];
    setGlobalLogger(makeErrorSpyLogger(errors));
    const story = new TestStory();

    const response = story.callErrorNotify(
      new Error('boom [секретная деталь] _y_'),
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    const text = String(response.notify?.text);
    expect(text).not.toContain('boom');
    expect(text).not.toContain('секретная деталь');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
    // Ввод не снят и не переустановлен — awaitInput-контекст живёт (переспрос)
    expect(response.release).toBeUndefined();
    expect(response.awaitInput).toBeUndefined();
    expect(errors.length).toBe(1);
    setGlobalLogger(undefined as unknown as Logger);
  });
});

describe('BotUiStory — ucErrorNotify (отказ UC DMG)', () => {
  const NoteErrors = ErrorDef.define('NOTE', {
    TAKEN: {
      kind: 'conflict',
      label: 'Заметка [уже] занята_',
      description: 'Тестовая ошибка конфликта.',
    },
  });

  test('ошибка Def → warn-реплика с label, без экрана', () => {
    const response = new TestStory().callUcErrorNotify(NoteErrors.TAKEN.make());

    expect(response.screen).toBeUndefined();
    expect(response.notify?.kind).toBe('warn');
    const text = String(response.notify?.text);
    expect(text).toContain('Заметка');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
  });

  test('отказ Policy → текст denyMessage', () => {
    const response = new TestStory().callUcErrorNotify(
      CoreErrors.ACCESS_DENIED.make({
        rule: 'isOwner',
        denyMessage: 'Только владелец',
      }),
    );

    expect(String(response.notify?.text)).toContain('Только владелец');
  });

  test('валидация входа → перечень полей из payload.issues', () => {
    const response = new TestStory().callUcErrorNotify(
      CoreErrors.INPUT_VALIDATION.make({
        issues: [{ path: 'title_1', message: 'Пусто [поле]' }],
      }),
    );

    expect(response.notify?.kind).toBe('warn');
    const text = String(response.notify?.text);
    expect(text).toContain('Ошибка валидации');
    expect(text).toContain('title');
    expect(text).toContain('Пусто');
    expect(() => assertMarkdownV2Safe(text)).not.toThrow();
  });

  test('internal и unauthorized → общее сообщение без label, error-лог', () => {
    const errors: unknown[] = [];
    setGlobalLogger(makeErrorSpyLogger(errors));
    try {
      const story = new TestStory();

      for (const error of [
        CoreErrors.SERVER_INTERNAL.make(),
        CoreErrors.UNAUTHORIZED.make({ callerKind: 'system' }),
      ]) {
        const response = story.callUcErrorNotify(error);
        expect(response.notify?.kind).toBe('warn');
        const text = String(response.notify?.text);
        expect(text).not.toContain(error.label);
        expect(text).toContain('Произошла ошибка');
      }
      expect(errors).toMatchObject([
        { code: 'SERVER_INTERNAL' },
        { code: 'UNAUTHORIZED', payload: { callerKind: 'system' } },
      ]);
    } finally {
      setGlobalLogger(undefined as unknown as Logger);
    }
  });

  test('not_found и conflict ядра → label из Def', () => {
    const story = new TestStory();

    for (const error of [
      CoreErrors.OPERATION_NOT_FOUND.make({ module: 'note', uc: 'x' }),
      CoreErrors.VERSION_CONFLICT.make({ aggregate: 'note', uuid: 'n-1' }),
    ]) {
      const response = story.callUcErrorNotify(error);
      expect(response.notify?.kind).toBe('warn');
      expect(String(response.notify?.text)).toContain(error.label);
    }
  });

  test('без issues и без denyMessage → запасной label', () => {
    const FallbackErrors = ErrorDef.define('NOTE', {
      INVALID: {
        kind: 'validation',
        label: 'Заметка некорректна',
        description: 'Тестовая ошибка валидации без полей.',
      },
      FORBIDDEN: {
        kind: 'access',
        label: 'Заметка закрыта',
        description: 'Тестовый отказ без текста правила.',
      },
    });
    const story = new TestStory();

    const invalid = String(
      story.callUcErrorNotify(FallbackErrors.INVALID.make()).notify?.text,
    );
    expect(invalid).toContain('Ошибка валидации');
    expect(invalid).toContain('Заметка некорректна');
    expect(
      String(
        story.callUcErrorNotify(FallbackErrors.FORBIDDEN.make()).notify?.text,
      ),
    ).toContain('Заметка закрыта');
  });
});

describe('BotUiStory — колбэк-хелперы', () => {
  test('cb: story:action:ids без префикса контроллера', () => {
    const story = new TestStory();
    expect(story.callCb('view', 'id-1', 'id-2')).toBe('anketa:view:id-1:id-2');
  });

  test('cbFor: чужая стори того же контроллера', () => {
    const story = new TestStory();
    expect(story.callCbFor('list', 'open', 'x')).toBe('list:open:x');
  });

  test('stripPrefix снимает префикс только своей стори', () => {
    const story = new TestStory();
    expect(story.callStripPrefix('anketa:view:1')).toBe('view:1');
    expect(story.callStripPrefix('other:view:1')).toBe('other:view:1');
  });

  test('formatDate: ISO → дд.мм.гггг', () => {
    const story = new TestStory();
    expect(story.callFormatDate('2026-09-05T00:00:00Z')).toBe('05.09.2026');
  });
});

// Нужен для типизации update в будущих кейсах (сохраняем поверхность)
describe('BotUiStory — поверхность', () => {
  test('unknownCommand: экран + warn-лог с кодом и контекстом', () => {
    const warns: Array<[string, string, Record<string, unknown> | undefined]> =
      [];
    setGlobalLogger(makeWarnSpyLogger(warns));
    const story = new TestStory();
    const session: BotSession = { dialog: { path: 'quest/anketa', seq: 2 } };

    const subject = {
      uuid: '11111111-1111-4111-8111-111111111111',
      big: 'x'.repeat(10_000),
    };

    const response = story.callUnknownCommand(
      'boom:1',
      new UserCaller(subject),
      session,
    );

    expect(String(response.screen?.text)).toContain('Неизвестная команда');
    expect(warns.length).toBe(1);
    expect(warns[0]?.[0]).toBe('bot');
    expect(warns[0]?.[2]).toEqual({
      code: 'anketa:boom:1',
      dialogPath: 'quest/anketa',
      actor: { kind: 'user', subjectId: subject.uuid },
    });
    expect(JSON.stringify(warns[0]?.[2]).length).toBeLessThan(500);
    setGlobalLogger(undefined as unknown as Logger);
  });

  test('handleCallback переопределён, handleMessage — дефолт ядра', async () => {
    const story = new TestStory();
    const session: BotSession = { dialog: { path: 'c/anketa', seq: 1 } };
    const update: BotUpdate = { type: 'message', text: 'текст', telegramId: 1 };

    expect(
      await story.handleCallback('view', new GuestCaller(), session),
    ).toEqual({});
    // Дефолт — реплика-отказ (контракт «обязана ответить» соблюдён ядром)
    expect(
      (await story.handleMessage(update, new GuestCaller(), session)).notify
        ?.text,
    ).toContain('не принимаются');
  });
});

describe('BotUiStory — делегаты билдеров ответов (ФР-2)', () => {
  test('screen/ask/notify/warn/note/go возвращают результат билдеров', () => {
    const story = new TestStory();
    const text = md`Текст экрана`;

    expect(story.callScreen(text)).toEqual(screen(text));
    expect(story.callAsk(text, { step: 1 })).toEqual(ask(text, { step: 1 }));
    expect(story.callNotify(text)).toEqual(notify(text));
    expect(story.callWarn(text)).toEqual(warn(text));
    expect(story.callNote(text)).toEqual(note(text));
    expect(story.callGo('menu:main')).toEqual(go('menu:main'));
  });

  test('kb/btn/btnUrl возвращают результат билдеров', () => {
    const story = new TestStory();

    expect(story.callKb([[story.callBtn('ОК', 'ok')]])).toEqual(
      kb([[btn('ОК', 'ok')]]),
    );
    expect(story.callBtnUrl('Сайт', 'https://x.y')).toEqual(
      btnUrl('Сайт', 'https://x.y'),
    );
  });

  test('btn + cb: код кнопки собирается через cb-хелпер стори', () => {
    const story = new TestStory();

    const button = story.callBtn('Далее', story.callCb('next', 'id-7'));

    expect(button).toEqual({ text: 'Далее', code: 'anketa:next:id-7' });
  });
});

describe('BotUiStory — ограничение типа актора', () => {
  test('актор — PersonCaller: произвольный объект не подходит (проверка типов)', () => {
    // @ts-expect-error TActor extends PersonCaller: `{ id: string }` — не Caller
    type NotAllowed = BotUiStory<{ id: string }>;
  });
});
