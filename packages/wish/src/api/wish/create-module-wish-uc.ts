import type { User } from '@u7-scl/app/domain';
import type {
  CreateModuleWishCmd,
  CreateModuleWishCmdMeta,
  WishTargetVo,
} from '@u7-scl/domain/wish';
import {
  CreateModuleWishCmdSchema,
  WishAr,
  WishPolicy,
} from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import * as v from 'valibot';
import { unwrapInfallible } from '../legacy-reject';
import { WishUseCase } from '../wish-uc';

/**
 * Use-case создания желания пройти модуль («запись на следующий/тот же модуль»).
 *
 * Валидация через фасад курса: getModulePlace покрывает и существование
 * модуля, и опубликованность курса (по опубликованным он и ищет).
 * Дедуп активного желания на ту же цель. Фиксация мгновенная (expressed),
 * без анкеты — студент уже верифицирован.
 */
export class CreateModuleWishUc extends WishUseCase<CreateModuleWishCmdMeta> {
  protected readonly ucName = 'create-module-wish' as const;
  protected readonly ucLabel = 'Создать желание пройти модуль' as const;
  protected readonly arMeta = {
    arName: 'Wish' as const,
    arLabel: 'Желание' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateModuleWishCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: CreateModuleWishCmd, actor: User): Promise<undefined> {
    // 1. Модуль существует в программе опубликованного курса
    //    (getModulePlace ищет только по опубликованным — отдельная проверка
    //    isCourseEnrollable не нужна, она дублировала бы эту).
    const courseFacade = this.resolve.courseFacade;
    const place = await courseFacade.getModulePlace(command.moduleId);
    if (!place) {
      this.throwWishError(
        WishErrors.MODULE_NOT_FOUND.make({ moduleId: command.moduleId }),
      );
    }

    // 2. Не более одного активного желания на пару (user, target).
    //    Проверяем ВСЕ желания на цель, а не «последнее»: при равных createdAt
    //    порядок сортировки недетерминирован и активное желание может
    //    оказаться не первым.
    const target: WishTargetVo = { kind: 'module', moduleId: command.moduleId };
    const active = (
      await this.repo.findAllByUserAndTarget(actor.uuid, target)
    ).find((w) => WishPolicy.isActive(w.status));
    if (active) {
      this.throwWishError(
        WishErrors.ALREADY_EXISTS.make({
          userId: actor.uuid,
          moduleId: command.moduleId,
          status: active.status,
        }),
      );
    }

    // 3. Мгновенная фиксация — без анкеты (студент уже верифицирован).
    // uuid и время — прикладного слоя, не домена.
    const wish = unwrapInfallible(
      WishAr.create(
        {
          uuid: crypto.randomUUID(),
          userId: actor.uuid,
          target,
          status: 'expressed',
        },
        Date.now(),
      ),
    );
    await this.repo.save(wish.snapshot());

    return undefined;
  }
}
