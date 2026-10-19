import { serializeError } from '#shared/serialize-error';
import { CoreErrors } from '../../kernel/errors/core-errors';
import type { DomainError } from '../../kernel/errors/error';
import type { Result } from '../../kernel/result/result';
import type { AppContext } from '../context';

/**
 * Прогон системной операции (ER, Job): отказ и исключение пишутся в лог —
 * вызвать её некому, иначе сбой пропал бы молча. Исключение превращается
 * в `SERVER_INTERNAL`.
 */
export async function runLogged<T>(
  app: AppContext,
  source: string,
  operation: () => Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  try {
    const res = await operation();
    if (!res.ok) {
      app.logger.error(source, `Отказ: ${res.error.code}`, {
        error: res.error,
      });
    }
    return res;
  } catch (error) {
    app.logger.error(source, 'Непредвиденный сбой', serializeError(error));
    return CoreErrors.SERVER_INTERNAL.err();
  }
}
