import {
  ListScopeReviewsUcDef,
  type PeerReviewModuleDef,
  ScopeReviewsDqs,
} from '@u7-scl/domain/peer-review';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Input = ParsedInputOf<typeof ListScopeReviewsUcDef>;

/** Отзывы скоупов по адресатам; фильтр отдаётся репозиторию, группировка — `ScopeReviewsDqs`. */
export class ListScopeReviewsUc extends UseCaseFromDef<
  typeof ListScopeReviewsUcDef,
  PeerReviewDeps,
  undefined,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(ListScopeReviewsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ scopeIds, filter }: Input) {
    const reviews = await this.resolve.reviews.findByScopes(scopeIds, filter);
    return ok({
      scopeIds,
      recipients: new ScopeReviewsDqs(reviews).groupByRecipient(),
    });
  }
}
