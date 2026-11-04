import {
  AbandonWishErDef,
  WishAr,
  type WishModuleDef,
} from '@u7-scl/domain/wish';
import { ok } from 'dmg-core';
import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
  type UnitOfWork,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type Def = typeof AbandonWishErDef;

/**
 * Пометка желания брошенным по прерыванию анкеты: чьё это желание и можно ли
 * его бросить, решает `WishAr`; реакция только загружает и сохраняет.
 */
export class AbandonWishEr extends ReactionFromDef<Def, WishDeps> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(AbandonWishErDef, deps, module);
  }

  protected async react(event: ReactionEnvelopeOf<Def>, uow: UnitOfWork) {
    const { respondentId: userId, ownerInfo } = event.payload;
    const target = WishAr.questionnaireTarget(ownerInfo);
    if (!target) return ok();
    const { wishes } = this.resolve;
    const wish = WishAr.current(
      await wishes.findAllByUserAndTarget(userId, target),
      userId,
      target,
    );
    if (!wish?.canAbandon()) return ok();
    const abandoned = wish.abandon(this.now());
    if (!abandoned.ok) return abandoned;
    uow.register(wish, wishes);
    return ok();
  }
}
