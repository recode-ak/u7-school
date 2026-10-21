/** Непосредственная причина операции и её событий. */
export type Cause =
  | { readonly kind: 'request'; readonly requestId: string }
  | { readonly kind: 'event'; readonly eventId: string }
  | { readonly kind: 'job'; readonly runId: string };

/**
 * След операции: `cause` — шаг назад, `correlationId` — вся цепочка от
 * точки входа (запрос транспорта или прогон Job) через все UC/ER/события.
 * Тип — в ядре: его несёт контекст межмодульного вызова (`CallContext`),
 * который видит тип фасада в домене.
 */
export type Trace = {
  readonly cause: Cause;
  readonly correlationId: string;
};
