/** Закрытый набор категорий ошибок — для общей обработки (UI, логи, адаптеры). */
export const ERROR_KINDS = [
  'validation',
  'unauthorized',
  'access',
  'not_found',
  'conflict',
  'internal',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/**
 * Значение ошибки: штатный отказ, передаётся в `Err`.
 * Транспорт не знает (D-14): маппинг на HTTP/MCP/текст — в адаптерах.
 */
export type DomainError<
  C extends string = string,
  K extends ErrorKind = ErrorKind,
  P = unknown,
> = {
  readonly code: C;
  readonly kind: K;
  readonly label: string;
  readonly description: string;
  readonly payload: P;
};
