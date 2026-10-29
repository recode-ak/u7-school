import {
  ListScopeFactsUcDef,
  type PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Input = ParsedInputOf<typeof ListScopeFactsUcDef>;

/** Факты отзывов скоупа (ФР-8): есть ли и сколько. */
export class ListScopeFactsUc extends UseCaseFromDef<
  typeof ListScopeFactsUcDef,
  PeerReviewDeps,
  undefined,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(ListScopeFactsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ scopeId }: Input) {
    const reviews = await this.resolve.reviews.findByScope(scopeId);
    return ok({
      hasReviews: reviews.length > 0,
      reviewsCount: reviews.length,
    });
  }
}
