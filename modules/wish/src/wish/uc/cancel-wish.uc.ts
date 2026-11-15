import {
  CancelWishUcDef,
  type WishAr,
  type WishModuleDef,
  WishPairErrors,
  WishSelectionDqs,
} from '@u7-scl/domain/wish';
import { type Caller, err, type Identified, ok } from 'dmg-core';
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
  Identified
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CancelWishUcDef, deps, module);
  }

  /** Текущее желание субъекта на цель; нет желания — `WISH_NOT_FOUND`. */
  protected async load(target: Input, caller: Caller<Identified>) {
    const userId = this.subject(caller).uuid;
    const wishes = await this.resolve.wishes.findAllByUserAndTarget(
      userId,
      target,
    );
    const wish = new WishSelectionDqs(wishes).latest();
    if (wish) return ok({ wish });
    return err(new WishPairErrors(userId, target).notFound());
  }

  protected async execute(
    { expectedVersion }: Input,
    { wish }: Loaded,
    uow: UnitOfWork,
  ) {
    // Устаревшее действие клиента — отказ до отмены (D-57).
    const expected = this.expectVersion(wish, expectedVersion);
    if (!expected.ok) return expected;
    const cancelled = wish.cancel(this.now());
    if (!cancelled.ok) return cancelled;
    uow.register(wish, this.resolve.wishes);
    return ok({});
  }
}
