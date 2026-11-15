import {
  ConfirmWishErDef,
  type WishModuleDef,
  WishQuestionnaireOwner,
  WishSelectionDqs,
} from '@u7-scl/domain/wish';
import { ok } from 'dmg-core';
import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
  type UnitOfWork,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type Def = typeof ConfirmWishErDef;

/**
 * Подтверждение желания по завершении анкеты: чьё это желание и можно ли
 * его подтвердить, решает `WishAr`; реакция только загружает и сохраняет.
 */
export class ConfirmWishEr extends ReactionFromDef<Def, WishDeps> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(ConfirmWishErDef, deps, module);
  }

  protected async react(event: ReactionEnvelopeOf<Def>, uow: UnitOfWork) {
    const { respondentId: userId, ownerInfo } = event.payload;
    const target = WishQuestionnaireOwner.parse(ownerInfo)?.target();
    if (!target) return ok();
    const { wishes } = this.resolve;
    const wish = new WishSelectionDqs(
      await wishes.findAllByUserAndTarget(userId, target),
    ).current(userId, target);
    if (!wish?.canConfirm()) return ok();
    const confirmed = wish.confirm(this.now());
    if (!confirmed.ok) return confirmed;
    uow.register(wish, wishes);
    return ok();
  }
}
