/** Непосредственная причина операции и её событий. */
export type Cause =
  | { readonly kind: 'request'; readonly requestId: string }
  | { readonly kind: 'event'; readonly eventId: string }
  | { readonly kind: 'job'; readonly runId: string };

/**
 * След операции: `cause` — шаг назад, `correlationId` — вся цепочка от
 * точки входа (запрос транспорта или прогон Job) через все UC/ER/события.
 */
export type Trace = {
  readonly cause: Cause;
  readonly correlationId: string;
};

/**
 * Мета запроса от транспорта. Параметр обязателен, чтобы адаптер не забыл
 * его прокинуть; `requestId` может не прийти от клиента — тогда ядро
 * создаёт его само и пишет `warn` (ERR-07).
 */
export type RequestMeta = {
  readonly requestId: string | undefined;
  /** Сквозной id многошагового сценария клиента; по умолчанию — `requestId`. */
  readonly correlationId?: string;
};

/** След запроса; `onMissing` — сообщить, что клиент не передал `requestId`. */
export function requestTrace(
  meta: RequestMeta,
  onMissing: (message: string) => void,
): Trace {
  let { requestId } = meta;
  if (requestId === undefined) {
    requestId = crypto.randomUUID();
    onMissing(`Клиент не передал requestId — создан ${requestId}`);
  }
  return {
    cause: { kind: 'request', requestId },
    correlationId: meta.correlationId ?? requestId,
  };
}
