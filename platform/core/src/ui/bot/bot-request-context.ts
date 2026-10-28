import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Контекст запроса бота на время обработки одного апдейта Telegram
 * (вариант B кандидата bot-request-id, TR-30).
 *
 * Транспорт запускает обработку апдейта в `run(update_id, …)`; вызов UC
 * берёт отсюда след без смены сигнатур `handle*` стори: `correlationId =
 * tg:<update_id>` — общий для вызовов апдейта, `requestId =
 * tg:<update_id>#<n>` — n-й вызов UC за апдейт. Story детерминирована,
 * поэтому при повторной доставке апдейта n тот же — отсев повторов
 * (D-56 пакета) узнаёт команду.
 *
 * Неявный контекст — временный: в `dmg-ui` контракт story несёт id запроса
 * явно.
 */
// DEBT-41: id апдейта до story — неявным контекстом, не через контракт story.
export class BotRequestContext {
  static readonly #storage = new AsyncLocalStorage<BotRequestContext>();

  /** Номер последнего выданного вызова UC за апдейт. */
  #calls = 0;

  private constructor(private readonly updateId: number) {}

  /** Исполняет обработку апдейта в его контексте (счётчик вызовов — с нуля). */
  static run<T>(updateId: number, fn: () => T): T {
    return BotRequestContext.#storage.run(new BotRequestContext(updateId), fn);
  }

  /** Контекст текущего апдейта; вне обработки апдейта — `undefined`. */
  static current(): BotRequestContext | undefined {
    return BotRequestContext.#storage.getStore();
  }

  /** Сквозной id апдейта — общий для всех вызовов UC за апдейт. */
  get correlationId(): string {
    return `tg:${this.updateId}`;
  }

  /** Id следующего вызова UC за апдейт. */
  nextRequestId(): string {
    this.#calls += 1;
    return `${this.correlationId}#${this.#calls}`;
  }
}
