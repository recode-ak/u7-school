/**
 * Сериализует любую ошибку в плоский Record<string, unknown>,
 * пригодный для передачи в meta-параметр логгера.
 *
 * Извлекает максимум деталей:
 * - Error        → message, stack, cause
 * - Прочие       → значение как строка
 *
 * Используй в обработчиках ошибок вместо String(err).
 *
 * @example
 * logger.error('bot', 'Ошибка', serializeError(err));
 */
export function serializeError(err: unknown): Record<string, unknown> {
  // 1. Обычный Error
  if (err instanceof Error) {
    const result: Record<string, unknown> = {
      message: err.message,
      name: err.name,
    };
    if (err.stack) result.stack = err.stack;

    // cause (может быть вложенным Error)
    if (err.cause) {
      result.cause =
        err.cause instanceof Error ? err.cause.message : String(err.cause);
    }

    return result;
  }

  // 2. Всё остальное
  return { error: String(err) };
}
