import { U7ApiModule } from '@u7-scl/app-legacy/domain';
import type { ErMeta, EventReaction } from '@u7-scl/core/api';
import type {
  PeerReviewApiModuleMeta,
  PeerReviewApiModuleResolver,
} from '@u7-scl/domain/peer-review';
import { NotifyReviewRecipientEr } from './er/notify-review-recipient-er';
import { CreateReviewUc } from './review/create-review-uc';
import { GetMyReviewUc } from './review/get-my-review-uc';
import { ListMyReviewsUc } from './review/list-my-reviews-uc';
import { ListScopeFactsUc } from './review/list-scope-facts-uc';
import { ListScopeReviewsUc } from './review/list-scope-reviews-uc';

export class PeerReviewApiModule extends U7ApiModule<
  PeerReviewApiModuleMeta,
  PeerReviewApiModuleResolver
> {
  readonly name = 'peer-review' as const;
  /**
   * UC рецензий (ФР-7). Кампании (2 UC и ER из событий stream) — в Def-модуле
   * `peer-review.module.ts`; здесь остаётся только то, что ждёт срезов Ф2/Ф3.
   */
  readonly useCases = [
    new CreateReviewUc(),
    new GetMyReviewUc(),
    new ListMyReviewsUc(),
    new ListScopeReviewsUc(),
    new ListScopeFactsUc(),
  ];
  readonly reactions: EventReaction<ErMeta>[] = [new NotifyReviewRecipientEr()];
  readonly jobs = [];
}
