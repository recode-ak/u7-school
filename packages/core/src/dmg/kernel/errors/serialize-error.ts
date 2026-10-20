/**
 * Плоское описание любой ошибки для meta-параметра логгера: message, name,
 * stack и cause у `Error`, строка — у остального.
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const result: Record<string, unknown> = {
      message: error.message,
      name: error.name,
    };
    if (error.stack) result.stack = error.stack;
    if (error.cause) {
      result.cause =
        error.cause instanceof Error
          ? error.cause.message
          : String(error.cause);
    }
    return result;
  }
  return { error: String(error) };
}
