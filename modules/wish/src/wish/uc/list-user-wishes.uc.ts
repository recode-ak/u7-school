import { ListUserWishesUcDef, type WishModuleDef } from '@u7-scl/domain/wish';
import { type Caller, type Identified, ok } from 'dmg-core';
import { type UnitOfWork, UseCaseFromDef } from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

export class ListUserWishesUc extends UseCaseFromDef<
  typeof ListUserWishesUcDef,
  WishDeps,
  undefined,
  Identified
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(ListUserWishesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  /** Выход — `view()` желаний субъекта (D-44); ничего не пишет. */
  protected async execute(
    _: unknown,
    __: undefined,
    ___: UnitOfWork,
    caller: Caller<Identified>,
  ) {
    const wishes = await this.resolve.wishes.findByUser(
      this.subject(caller).uuid,
    );
    return ok(wishes.map((wish) => wish.view()));
  }
}
