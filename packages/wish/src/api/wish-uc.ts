import { U7UseCase } from '@u7-scl/app/domain';
import type { UcMeta } from '@u7-scl/core/api';
import type { WishApiModuleResolver, WishRepo } from '@u7-scl/domain/wish';

/**
 * Базовый класс для всех use-case'ов модуля wish.
 */
export abstract class WishUseCase<TMeta extends UcMeta> extends U7UseCase<
  TMeta,
  WishApiModuleResolver
> {
  protected get repo(): WishRepo {
    return this.resolve.wishRepo;
  }
}
