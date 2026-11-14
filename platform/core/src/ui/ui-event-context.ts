import { AsyncLocalStorage } from 'node:async_hooks';

/** Часть конверта события, из которой строится след реакции. */
export type UiEventStamp = {
  readonly eventId: string;
  readonly correlationId: string;
};

/**
 * Контекст реакции UI на доменное событие — на время обработчика подписки.
 * `UiApp` исполняет обработчик в `run(envelope, …)`;
 * вызов UC из реакции берёт отсюда след события (`Trace.fromEvent`): причина —
 * событие, цепочка — его `correlationId`, без нового id и без `warn` ERR-07.
 *
 * Пара к `BotRequestContext` (апдейт Telegram); неявный контекст — временный,
 * как и у него: в `dmg-ui` след передаётся явно.
 */
export class UiEventContext {
  static readonly #storage = new AsyncLocalStorage<UiEventContext>();

  private constructor(private readonly stamp: UiEventStamp) {}

  /** Исполняет реакцию на событие в его контексте. */
  static run<T>(envelope: UiEventStamp, fn: () => T): T {
    const { eventId, correlationId } = envelope;
    return UiEventContext.#storage.run(
      new UiEventContext({ eventId, correlationId }),
      fn,
    );
  }

  /** Контекст текущей реакции; вне обработчика подписки — `undefined`. */
  static current(): UiEventContext | undefined {
    return UiEventContext.#storage.getStore();
  }

  /** Id события — причина вызовов UC реакции. */
  get eventId(): string {
    return this.stamp.eventId;
  }

  /** Сквозной id цепочки события. */
  get correlationId(): string {
    return this.stamp.correlationId;
  }
}
