/** Непосредственная причина операции и её событий. */
export type Cause =
  | { readonly kind: 'request'; readonly requestId: string }
  | { readonly kind: 'event'; readonly eventId: string }
  | { readonly kind: 'job'; readonly runId: string };

/**
 * След операции: `cause` — шаг назад, `correlationId` — вся цепочка от
 * точки входа (запрос транспорта или прогон Job) через все UC/ER/события.
 * Тип — в ядре: его принимает фасад модуля (`Facade<M>.handle`) —
 * контракт в домене.
 */
export type Trace = {
  readonly cause: Cause;
  readonly correlationId: string;
  /**
   * Канал входа (`telegram`, `web`, …) и посетитель в нём (tgId, id
   * анонимной сессии): задаётся на входе и идёт по цепочке (D-43).
   */
  readonly channel?: TraceChannel;
};

/** Канал входа операции и посетитель в нём. */
export type TraceChannel = {
  readonly name: string;
  readonly visitorId?: string;
};
