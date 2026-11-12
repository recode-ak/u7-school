import type { DomainError, Identified, PersonCaller } from 'dmg-core';
import type { ApiApp } from 'dmg-core/app';
import type { Logger } from '../../shared/logger';
import { getGlobalLogger } from '../../shared/logger';
import { type MdText, md, mdConcat, mdJoin } from '../../shared/markdown';
import { serializeError } from '../../shared/serialize-error';
import { UiStory } from '../ui-story';
import type { BotUiAppResolve } from './app-types';
import { DialogCache } from './dialog-cache';
import type { KbButton } from './response-builders';
import * as rb from './response-builders';
import type {
  BotSession,
  BotUpdate,
  CommandReaction,
  CommandUpdate,
  DialogResponse,
  KeyboardDescription,
  ProactiveSender,
} from './types';

/**
 * Абстрактная стори на контракте «Диалог и Экран».
 */
export abstract class BotUiStory<
  TActor extends PersonCaller = PersonCaller,
  TResolve extends BotUiAppResolve<TActor> = BotUiAppResolve<TActor>,
> extends UiStory<TResolve> {
  abstract readonly name: string;

  /** API приложения — для вызовов useCases */
  protected appApi!: ApiApp<Identified>;

  /** Родитель (BotController) — получается через init отдельным аргументом */
  protected proactiveSender!: ProactiveSender;

  /** Системный эпохальный кеш стори (сброс при смене диалога): страницы
   * пагинатора и другие пересобираемые данные домена. Дефолт — собственный
   * инстанс (юнит-тесты стори без каскада init тоже получают кеш);
   * прикладное ядро подменяет общим инстансом BotUiApp. */
  protected dialogCache: DialogCache = new DialogCache();

  protected get logger(): Logger | undefined {
    return getGlobalLogger();
  }

  /**
   * Инициализация сценария — вызывается контроллером при старте бота.
   */
  override init(
    resolve: TResolve,
    proactiveSender?: ProactiveSender,
    dialogCache?: DialogCache,
  ): void {
    this.appApi = resolve.appApi;
    if (proactiveSender) {
      this.proactiveSender = proactiveSender;
    }
    if (dialogCache) {
      this.dialogCache = dialogCache;
    }
    super.init(resolve);
  }

  /** Сброс временных данных сценария (переопределяется при необходимости) */
  reset(): void {}

  /**
   * Кнопки выхода на экранах ошибок (ядро не знает кодов приложения).
   * Переопределяется прикладным слоем (например, «⬅️ Меню»); пустой
   * массив — экран ошибки без клавиатуры, как сейчас.
   */
  protected errorExitRows(): { text: string; code: string }[][] {
    return [];
  }

  /** Обработка callback — реализуется в наследниках */
  abstract handleCallback(
    action: string,
    actor: TActor,
    session: BotSession,
  ): Promise<DialogResponse>;

  /**
   * Текстовый ввод (диалог ждёт ввод — awaitInput). Адресат всегда один —
   * активная стори: обязана ответить (без null).
   *
   * Дефолт должен быть недостижим: awaitInput делает стори, умеющая
   * принимать ввод (переопределяет метод). Дошедший ввод — программная
   * ошибка: warn разработчику + явная реплика-отказ пользователю
   * (исключение не бросаем — контроллер превратил бы его в экран
   * «внутренняя ошибка», непонятный пользователю) + `release`: контекст
   * ввода сброшен, пользователь выведен из зависшего ожидания — ошибка
   * самоликвидируется, а не циклично повторяется. Ввод БЕЗ ожидания
   * до стори не доходит — его перехватывает транспорт.
   */
  async handleMessage(
    _update: BotUpdate,
    _actor: TActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    this.logger?.warn(
      'bot',
      'Ввод дошёл до стори без переопределённого handleMessage (awaitInput без обработчика)',
      { story: this.name, dialogPath: session.dialog?.path },
    );
    return {
      ...this.notify(md`Извините, на данном этапе сообщения не принимаются\\.`),
      release: true,
    };
  }

  /**
   * Команда стори в трёхуровневом pipe (ФР-4).
   */
  async handleCommand(
    _update: CommandUpdate,
    _actor: TActor,
    _session: BotSession,
  ): Promise<CommandReaction> {
    return { reaction: 'pass' };
  }

  // ── Делегаты чистых билдеров ответов (ФР-2) ──
  // Тонкие переадресации: доменный язык ответов прямо в наследниках —
  // this.screen(...), this.ask(...), this.warn(...) вместо ручных литералов.

  /** Экран: текст + (опц.) клавиатура. */
  protected screen(
    text: MdText,
    keyboard?: KeyboardDescription,
  ): DialogResponse {
    return rb.screen(text, keyboard);
  }

  /** Спросить: экран + ожидание текстового ввода с контекстом. */
  protected ask(
    text: MdText,
    context: unknown,
    keyboard?: KeyboardDescription,
  ): DialogResponse {
    return rb.ask(text, context, keyboard);
  }

  /** Уведомить: реплика поверх диалога без kind (дефолтный вид транспорта 🔔). */
  protected notify(text: MdText): DialogResponse {
    return rb.notify(text);
  }

  /** Предупреждение поверх диалога (kind: 'warn'). */
  protected warn(text: MdText): DialogResponse {
    return rb.warn(text);
  }

  /** Инфо-заметка поверх диалога (kind: 'info'). */
  protected note(text: MdText): DialogResponse {
    return rb.note(text);
  }

  /** Уйти: делегировать диалог по пути. */
  protected go(path: string): DialogResponse {
    return rb.go(path);
  }

  /** Клавиатура: isMultiple: false по умолчанию, multiple: true — опция. */
  protected kb(
    rows: KbButton[][],
    opts?: { multiple?: boolean },
  ): KeyboardDescription {
    return rb.kb(rows, opts);
  }

  /** Callback-кнопка. */
  protected btn(text: string, code: string): KbButton {
    return rb.btn(text, code);
  }

  /** Кнопка-ссылка. */
  protected btnUrl(text: string, url: string): KbButton {
    return rb.btnUrl(text, url);
  }

  // ── Подтверждение действия (confirm-хелпер) ──

  /**
   * Строит confirm-экран: кнопка подтверждения и кнопка отмены.
   *
   * Convention: `action` → `action-confirm`.
   * При подтверждении генерируется callback: `action-confirm:targetId[:extraData]`.
   *
   * @param action    — базовое действие (напр. 'mark-abandoned', 'complete')
   * @param targetId  — id объекта (UUID студента, потока)
   * @param text      — текст-подтверждение (MdText: доменные данные — через md-интерполяцию)
   * @param opts      — опции (текст кнопок, куда вернуться при отмене, доп. данные)
   */
  protected confirm(
    action: string,
    targetId: string,
    text: MdText,
    opts?: {
      /** Текст на кнопке подтверждения (по умолчанию '✅ Да') */
      confirmButton?: string;
      /** Текст на кнопке отмены (по умолчанию '❌ Отмена') */
      cancelButton?: string;
      /** Куда вернуться при отмене: story:action (по умолчанию this.name:detail) */
      cancelCode?: string;
      /** Дополнительные данные, добавляемые через : после id */
      extraData?: string;
    },
  ): DialogResponse {
    const confirmCode = `${action}-confirm`;
    const extra = opts?.extraData ? `:${opts.extraData}` : '';
    const cancelCode =
      opts?.cancelCode ?? this.cbFor(this.name, 'detail', targetId);

    return this.screen(
      text,
      this.kb([
        [
          this.btn(
            opts?.confirmButton ?? '✅ Да',
            this.cbFor(this.name, confirmCode, targetId) + extra,
          ),
          this.btn(opts?.cancelButton ?? '❌ Отмена', cancelCode),
        ],
      ]),
    );
  }

  // ── Формирование callback_data (только реальные данные, без сжатия) ──

  /**
   * Колбэк для своей стори. Возвращает `storyName:action[:id...]`.
   *
   * @param action — имя действия (view, list, complete, ...)
   * @param ids — реальные значения id (UUID, ключи)
   */
  protected cb(action: string, ...ids: string[]): string {
    return [this.name, action, ...ids].join(':');
  }

  /**
   * Кросс-стори колбэк: кнопка, ведущая в другую стори того же контроллера.
   *
   * @param storyName — имя целевой стори
   * @param action — имя действия
   * @param ids — реальные значения id
   */
  protected cbFor(storyName: string, action: string, ...ids: string[]): string {
    return [storyName, action, ...ids].join(':');
  }

  /**
   * Экран «Неизвестная команда» для ветки внутри стори.
   */
  protected unknownCommand(
    action: string,
    actor?: TActor,
    session?: BotSession,
  ): DialogResponse {
    this.logger?.warn('bot', 'Кнопка без обработчика', {
      code: `${this.name}:${action}`,
      dialogPath: session?.dialog?.path,
      ...(actor !== undefined ? { actor: actor.toLog() } : {}),
    });
    return this.screen(md`⚠️ Неизвестная команда`);
  }

  /** Убирает префикс сценария из callback_data */
  protected stripPrefix(data: string): string {
    const prefix = `${this.name}:`;
    if (data.startsWith(prefix)) {
      return data.slice(prefix.length);
    }
    return data;
  }

  /** Форматирует ISO-дату в читаемый вид (дд.мм.гггг). */
  protected formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return iso;
    }
  }

  /**
   * Универсальный обработчик ошибок: ошибка.
   *
   * Любое необработанное исключение — internal: логирует и возвращает
   * общее сообщение (доменные данные не утекают).
   */
  protected handleError(err: unknown): DialogResponse {
    // Клавиатура выхода на экране ошибки (errorExitRows), если задана
    const exitRows = this.errorExitRows();
    const errorKb = exitRows.length > 0 ? this.kb(exitRows) : undefined;

    this.logger?.error('bot', 'Ошибка в story', serializeError(err));
    return this.screen(
      md`⚠️ *Произошла внутренняя ошибка*\n\nПожалуйста, попробуйте позже или обратитесь к администратору\\.`,
      errorKb,
    );
  }

  /**
   * Отказ UC DMG (`Err` ответа `appApi.dispatch`) — warn-реплика без
   * захвата экрана, как `errorNotify`. Ветвление по `kind` ошибки DMG:
   * - `validation` — перечисляет поля из `payload.issues`, иначе `label`;
   * - `access` — `denyMessage` отказавшего правила, иначе `label`;
   * - `not_found`, `conflict` — `label` из Def;
   * - `internal`, `unauthorized` — логирует и возвращает общее сообщение
   *   (доменные данные не утекают).
   */
  protected ucErrorNotify(error: DomainError): DialogResponse {
    switch (error.kind) {
      case 'validation': {
        const issues = issuesOf(error.payload);
        if (issues.length > 0) {
          const lines = issues.map((i) => md`• *${i.path}*: ${i.message}`);
          return this.warn(mdConcat(md`*Ошибка валидации*\n\n`, mdJoin(lines)));
        }
        return this.warn(md`*Ошибка валидации*\n\n${error.label}`);
      }

      case 'access':
        return this.warn(md`${denyMessageOf(error.payload) ?? error.label}`);

      case 'not_found':
      case 'conflict':
        return this.warn(md`${error.label}`);

      case 'internal':
      case 'unauthorized':
        this.logger?.error('bot', 'Отказ UC в story', {
          code: error.code,
          kind: error.kind,
          payload: error.payload,
        });
        return this.warn(
          md`Произошла ошибка\\. Попробуйте ещё раз или обратитесь к администратору\\.`,
        );
    }
  }

  /**
   * Реплика-ошибка без захвата экрана (ФР-5): warn-уведомление поверх
   * диалога (`notify.kind: 'warn'`), экран и ввод не трогает —
   * при валидации ввода awaitInput-контекст сохраняется (переспрос),
   * в pipe-командах — ошибка без перерисовки экрана.
   *
   * Любое исключение — internal: логирует и возвращает общее сообщение
   * (доменные данные не утекают).
   */
  protected errorNotify(err: unknown): DialogResponse {
    this.logger?.error('bot', 'Ошибка в story', serializeError(err));
    return this.warn(
      md`Произошла ошибка\\. Попробуйте ещё раз или обратитесь к администратору\\.`,
    );
  }
}

/** Поля из `payload.issues` ошибки валидации DMG (`INPUT_VALIDATION`). */
function issuesOf(
  payload: unknown,
): ReadonlyArray<{ path: string; message: string }> {
  if (typeof payload !== 'object' || payload === null) return [];
  if (!('issues' in payload) || !Array.isArray(payload.issues)) return [];
  return payload.issues;
}

/** Текст отказа правила Policy (`ACCESS_DENIED.payload.denyMessage`). */
function denyMessageOf(payload: unknown): string | undefined {
  return typeof payload === 'object' &&
    payload !== null &&
    'denyMessage' in payload &&
    typeof payload.denyMessage === 'string'
    ? payload.denyMessage
    : undefined;
}
