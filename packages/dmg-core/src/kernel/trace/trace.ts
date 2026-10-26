import * as v from 'valibot';

/** Непосредственная причина операции и её событий. */
export type Cause =
  | { readonly kind: 'request'; readonly requestId: string }
  | { readonly kind: 'event'; readonly eventId: string }
  | { readonly kind: 'job'; readonly job: string; readonly runId: string };

/** Канал входа операции и посетитель в нём. */
export type TraceChannel = {
  readonly name: string;
  readonly visitorId?: string;
};

/** Мета запроса транспорта — вход `Trace.fromRequest`. */
export type RequestMeta = {
  /** Id запроса от клиента; нет — создаёт `fromRequest` с сообщением. */
  readonly requestId?: string;
  /** Сквозной id многошагового сценария клиента; по умолчанию — `requestId`. */
  readonly correlationId?: string;
  readonly channel?: TraceChannel;
};

/** След в форме для лога операций (JSON). */
export type TraceLog = {
  readonly cause: Cause;
  readonly correlationId: string;
  readonly channel?: TraceChannel;
};

/**
 * След в JSON — для передачи через границу процесса (D-46): `toJSON()` у
 * отправителя, `Trace.fromJSON()` у получателя. Без канала — без поля.
 */
export type TraceJson = TraceLog;

const TraceJsonSchema = v.object({
  cause: v.variant('kind', [
    v.object({ kind: v.literal('request'), requestId: v.string() }),
    v.object({ kind: v.literal('event'), eventId: v.string() }),
    v.object({ kind: v.literal('job'), job: v.string(), runId: v.string() }),
  ]),
  correlationId: v.string(),
  channel: v.optional(
    v.object({ name: v.string(), visitorId: v.optional(v.string()) }),
  ),
});

/** Часть следа в конверте события: причина и цепочка, без канала. */
export type TraceStamp = {
  readonly cause: Cause;
  readonly correlationId: string;
};

/**
 * След операции (D-43, caller.md §2 п. 5): `cause` — шаг назад,
 * `correlationId` — вся цепочка от точки входа (запрос транспорта или
 * прогон Job) через все UC/ER/события, `channel` — канал входа и посетитель
 * в нём (задаётся на входе и идёт по цепочке вызовов). Создаётся только
 * фабриками точек входа; внутрь операций передаётся неизменным. Класс — в
 * ядре: его принимает фасад модуля (`Facade<M>.handle`) — контракт в домене.
 */
export class Trace {
  private constructor(
    readonly cause: Cause,
    readonly correlationId: string,
    readonly channel?: TraceChannel,
  ) {}

  /**
   * След запроса транспорта. Клиент обязан передать `requestId`; не
   * передал (или пустая строка) — id создаётся, а `onMissing` получает
   * сообщение (минимум `warn`, ERR-07). Без `onMissing` тип требует id.
   */
  static fromRequest(meta: RequestMeta & { readonly requestId: string }): Trace;
  static fromRequest(
    meta: RequestMeta,
    onMissing: (message: string) => void,
  ): Trace;
  static fromRequest(
    meta: RequestMeta,
    onMissing?: (message: string) => void,
  ): Trace {
    const requestId = Trace.requestIdOf(meta.requestId, onMissing);
    return new Trace(
      { kind: 'request', requestId },
      meta.correlationId ?? requestId,
      meta.channel,
    );
  }

  /** След реакции на событие: причина — событие, цепочка — его. */
  static fromEvent(event: {
    readonly eventId: string;
    readonly correlationId: string;
  }): Trace {
    return new Trace(
      { kind: 'event', eventId: event.eventId },
      event.correlationId,
    );
  }

  /**
   * След одного прогона Job: свой `runId` — причина и `correlationId` всех
   * его событий. Создаёт вызывающий прогон (планировщик, мост legacy).
   */
  static forJob(def: { readonly name: string }): Trace {
    const runId = crypto.randomUUID();
    return new Trace({ kind: 'job', job: def.name, runId }, runId);
  }

  /**
   * След из JSON другого процесса (D-46). Невалидный JSON — `Error`: это
   * дефект транспорта, не доменная ошибка.
   */
  static fromJSON(json: unknown): Trace {
    const parsed = v.safeParse(TraceJsonSchema, json);
    if (!parsed.success) {
      throw new Error(
        `Trace.fromJSON: невалидный JSON — ${v.summarize(parsed.issues)}`,
      );
    }
    const { cause, correlationId, channel } = parsed.output;
    return new Trace(cause, correlationId, channel);
  }

  /** След для записи лога операций; без канала — без поля. */
  toLog(): TraceLog {
    return this.toJSON();
  }

  /** Форма для границы процесса (D-46); без канала — без поля. */
  toJSON(): TraceJson {
    const { cause, correlationId, channel } = this;
    return channel === undefined
      ? { cause, correlationId }
      : { cause, correlationId, channel };
  }

  /** Поля следа в конверте события (UoW, мосты legacy). */
  toEnvelope(): TraceStamp {
    return { cause: this.cause, correlationId: this.correlationId };
  }

  private static requestIdOf(
    raw: string | undefined,
    onMissing: ((message: string) => void) | undefined,
  ): string {
    if (raw !== undefined && raw !== '') return raw;
    if (onMissing === undefined) {
      throw new Error('Trace.fromRequest: нет requestId и нет onMissing');
    }
    const requestId = crypto.randomUUID();
    onMissing(`Клиент не передал requestId — создан ${requestId}`);
    return requestId;
  }
}
