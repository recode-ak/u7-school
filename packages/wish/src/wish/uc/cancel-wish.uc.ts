// DEBT-21, DEBT-22: субъект вызывающего — legacy `User` (`@u7-scl/app`).
import type { User } from '@u7-scl/app/domain';
import {
  CancelWishUcDef,
  type WishAr,
  WishErrors,
  type WishModuleDef,
} from '@u7-scl/domain/wish';
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

/** Загруженное — контекст Policy `canCancel` и правила `cancellable`. */
type Loaded = { readonly wish: WishAr };

type Input = ParsedInputOf<typeof CancelWishUcDef>;

export class CancelWishUc extends UseCaseFromDef<
  typeof CancelWishUcDef,
  WishDeps,
  Loaded,
  User
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CancelWishUcDef, deps, module);
  }

  /** Текущее желание субъекта на цель; нет желания — `WISH_NOT_FOUND`. */
  protected async load(target: Input, caller: Caller<User>) {
    const userId = this.subject(caller).uuid;
    const wish = await this.resolve.wishes.findCurrentByUserAndTarget(
      userId,
      target,
    );
    if (wish) return ok({ wish });
    return target.kind === 'course'
      ? WishErrors.NOT_FOUND.err({ userId, courseId: target.courseId })
      : WishErrors.NOT_FOUND.err({ userId, moduleId: target.moduleId });
  }

  protected async execute(_input: Input, { wish }: Loaded, uow: UnitOfWork) {
    const cancelled = wish.cancel(this.now());
    if (!cancelled.ok) return cancelled;
    uow.register(wish, this.resolve.wishes);
    return ok({});
  }
}
