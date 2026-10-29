import {
  GetMyReviewUcDef,
  type PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review';
import { type Caller, type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Input = ParsedInputOf<typeof GetMyReviewUcDef>;

/** Мой отзыв адресату в кампании; автор — субъект вызова. */
export class GetMyReviewUc extends UseCaseFromDef<
  typeof GetMyReviewUcDef,
  PeerReviewDeps,
  undefined,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(GetMyReviewUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    { campaignId, recipientId }: Input,
    _: undefined,
    __: unknown,
    caller: Caller<Identified>,
  ) {
    const review = await this.resolve.reviews.findByPair(
      campaignId,
      this.subject(caller).uuid,
      recipientId,
    );
    return ok(review ? { found: true, text: review.text } : { found: false });
  }
}
