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

/** Мета запроса, которую адаптер транспорта передаёт в `appApi.run`. */
export type RequestMeta = {
  readonly requestId: string;
  /** Сквозной id многошагового сценария клиента; по умолчанию — `requestId`. */
  readonly correlationId?: string;
};

/** След операции, начатой запросом транспорта. */
export function requestTrace(meta: RequestMeta): Trace {
  return {
    cause: { kind: 'request', requestId: meta.requestId },
    correlationId: meta.correlationId ?? meta.requestId,
  };
}

/**
 * `requestId` входящего запроса — для адаптера, который разбирает
 * `Request`: клиент обязан передать id; не передал — адаптер создаёт его
 * сам и сообщает через `onMissing` (минимум `warn`, ERR-07).
 */
export function incomingRequestId(
  raw: string | undefined,
  onMissing: (message: string) => void,
): string {
  if (raw !== undefined && raw !== '') return raw;
  const requestId = crypto.randomUUID();
  onMissing(`Клиент не передал requestId — создан ${requestId}`);
  return requestId;
}
