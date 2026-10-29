import { U7ApiModule } from '@u7-scl/app-legacy/domain';
import type {
  PeerReviewApiModuleMeta,
  PeerReviewApiModuleResolver,
} from '@u7-scl/domain/peer-review';

/**
 * Пустая оболочка legacy-модуля: все UC и реакции peer-review — в Def-модуле
 * `peer-review.module.ts`. Удаляется в Ф3 вместе с `U7ApiModule`.
 */
export class PeerReviewApiModule extends U7ApiModule<
  PeerReviewApiModuleMeta,
  PeerReviewApiModuleResolver
> {
  readonly name = 'peer-review' as const;
  readonly useCases = [];
  readonly reactions = [];
  readonly jobs = [];
}
