import {
  ListMyReviewsUcDef,
  type PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review';
import { type Caller, type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Input = ParsedInputOf<typeof ListMyReviewsUcDef>;

/**
 * «Отзывы мне» (S08): адресат — субъект вызова. Фильтр отдаётся репозиторию;
 * UC сортирует: новые наверху (`createdAt` ↓, затем `uuid` ↓).
 */
export class ListMyReviewsUc extends UseCaseFromDef<
  typeof ListMyReviewsUcDef,
  PeerReviewDeps,
  undefined,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(ListMyReviewsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    { filter }: Input,
    _: undefined,
    __: unknown,
    caller: Caller<Identified>,
  ) {
    const found = await this.resolve.reviews.findByRecipient(
      this.subject(caller).uuid,
      filter,
    );
    const reviews = found
      .map((ar) => ar.view())
      .sort((a, b) => b.createdAt - a.createdAt || b.uuid.localeCompare(a.uuid))
      .map((r) => ({
        reviewId: r.uuid,
        scopeId: r.scopeId,
        authorId: r.authorId,
        direction: r.direction,
        ...(r.authorOutcome ? { authorOutcome: r.authorOutcome } : {}),
        text: r.text,
        createdAt: r.createdAt,
      }));
    return ok({ reviews });
  }
}
