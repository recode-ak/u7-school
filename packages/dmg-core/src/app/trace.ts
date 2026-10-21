import type { Trace } from '#core/kernel/trace/trace';

export type { Cause, Trace, TraceChannel } from '#core/kernel/trace/trace';

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
 * След одного прогона Job: свой `runId` — причина и `correlationId` всех
 * его событий. Создаёт вызывающий прогон (планировщик, мост legacy).
 */
export function jobTrace(runId: string = crypto.randomUUID()): Trace {
  return { cause: { kind: 'job', runId }, correlationId: runId };
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
