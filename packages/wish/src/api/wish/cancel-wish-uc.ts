import type { User } from '@u7-scl/app/domain';
import type {
  CancelWishCmd,
  CancelWishCmdMeta,
  WishTargetVo,
} from '@u7-scl/domain/wish';
import { CancelWishCmdSchema, WishPolicy } from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import { CoreErrors, UserCaller } from 'dmg-core';
import * as v from 'valibot';
import { throwIfRejected, throwWishError } from '../legacy-reject';
import { WishUseCase } from '../wish-uc';

/**
 * Use-case отмены желания.
 *
 * Цель отмены явна в команде (дискриминированный вариант по kind:
 * course | module) — резолвится в WishTargetVo без изменения имени UC.
 */
export class CancelWishUc extends WishUseCase<CancelWishCmdMeta> {
  protected readonly ucName = 'cancel-wish' as const;
  protected readonly ucLabel = 'Отменить желание' as const;
  protected readonly arMeta = {
    arName: 'Wish' as const,
    arLabel: 'Желание' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CancelWishCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: CancelWishCmd, actor: User): Promise<undefined> {
    const target: WishTargetVo =
      command.kind === 'course'
        ? { kind: 'course', courseId: command.courseId }
        : { kind: 'module', moduleId: command.moduleId };

    const ar = await this.repo.findCurrentByUserAndTarget(actor.uuid, target);
    // Отмена разрешена только из expressed|confirmed; для pending — только abandon.
    if (!ar?.canCancel()) {
      this.throwWishError(
        WishErrors.NOT_FOUND.make(
          target.kind === 'course'
            ? { userId: actor.uuid, courseId: target.courseId }
            : { userId: actor.uuid, moduleId: target.moduleId },
        ),
      );
    }

    // Право отмены — только у автора. Через UC недостижимо (желание ищется
    // по актору), но ветка Policy обязательна; отказ — мост TR-1.
    const decision = WishPolicy.rules.canCancel.evaluate(
      new UserCaller(actor),
      { wish: ar },
    );
    if (!decision.allowed) {
      throwWishError(
        CoreErrors.ACCESS_DENIED.make({
          rule: decision.rule,
          denyMessage: decision.denyMessage,
        }),
      );
    }
    throwIfRejected(ar.cancel(Date.now()));
    await this.repo.save(ar);

    return undefined;
  }
}
