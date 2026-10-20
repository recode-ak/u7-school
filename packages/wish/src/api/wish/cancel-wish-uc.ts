import type { User } from '@u7-scl/app/domain';
import type {
  CancelWishCmd,
  CancelWishCmdMeta,
  WishTargetVo,
} from '@u7-scl/domain/wish';
import { CancelWishCmdSchema, WishAr } from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import * as v from 'valibot';
import { throwIfRejected } from '../legacy-reject';
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

    const wish = await this.repo.getByUserAndTarget(actor.uuid, target);
    // Отмена разрешена только из expressed|confirmed; для pending — только abandon.
    if (!wish || (wish.status !== 'expressed' && wish.status !== 'confirmed')) {
      this.throwWishError(
        WishErrors.NOT_FOUND.make(
          target.kind === 'course'
            ? { userId: actor.uuid, courseId: target.courseId }
            : { userId: actor.uuid, moduleId: target.moduleId },
        ),
      );
    }

    const ar = WishAr.restore(wish);
    throwIfRejected(ar.cancel(Date.now()));
    await this.repo.save(ar.snapshot());

    return undefined;
  }
}
