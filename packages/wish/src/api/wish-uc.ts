import { U7UseCase } from '@u7-scl/app/domain';
import type { UcMeta } from '@u7-scl/core/api';
import type { DomainError } from 'dmg-core';
import type { WishApiModuleResolver, WishRepo } from '../wish';
import { throwWishError as rejectWith } from './legacy-reject';

/**
 * Базовый класс для всех use-case'ов модуля wish.
 */
export abstract class WishUseCase<TMeta extends UcMeta> extends U7UseCase<
  TMeta,
  WishApiModuleResolver
> {
  /**
   * Бросает ошибку `WishErrors` как legacy-исключение. Принимает только
   * ошибки, код которых объявлен в `errors` меты UC (как `throwError`).
   */
  protected throwWishError(
    error: DomainError & { code: TMeta['errors']['name'] },
  ): never {
    rejectWith(error);
  }

  protected get repo(): WishRepo {
    return this.resolve.wishRepo;
  }
}
