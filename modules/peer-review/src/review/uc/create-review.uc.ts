import {
  CreateReviewUcDef,
  type PeerReviewModuleDef,
  ReviewAr,
  type ReviewCampaignAr,
  ReviewCampaignErrors,
  ReviewDraftDqs,
} from '@u7-scl/domain/peer-review';
import { type Caller, err, type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

/**
 * Загруженное — контекст Policy (`campaign`) и правил: окно (`campaign`,
 * `at`), адресат (`authorId`, `recipientId`), текст (`text`). `existing` —
 * отзыв этой пары, если он уже написан.
 */
type Loaded = {
  readonly campaign: ReviewCampaignAr;
  readonly at: number;
  readonly authorId: string;
  readonly recipientId: string;
  readonly text: string;
  readonly existing: ReviewAr | undefined;
};

type Input = ParsedInputOf<typeof CreateReviewUcDef>;

/**
 * Написать или перезаписать отзыв. Автор — субъект вызова. Право и правила
 * проверяет платформа до `execute`; здесь — первая запись (`create` с
 * направлением из `ReviewDraftDqs`, событие) либо перезапись текста пары.
 */
export class CreateReviewUc extends UseCaseFromDef<
  typeof CreateReviewUcDef,
  PeerReviewDeps,
  Loaded,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(CreateReviewUcDef, deps, module);
  }

  /** Кампания и отзыв пары; нет кампании — `REVIEW_CAMPAIGN_NOT_FOUND`. */
  protected async load(
    { campaignId, recipientId, text }: Input,
    caller: Caller<Identified>,
  ) {
    const campaign = await this.resolve.campaigns.findById(campaignId);
    if (!campaign) {
      return err(ReviewCampaignErrors.NOT_FOUND.make({ campaignId }));
    }
    const authorId = this.subject(caller).uuid;
    const existing = await this.resolve.reviews.findByPair(
      campaignId,
      authorId,
      recipientId,
    );
    return ok({
      campaign,
      at: this.now(),
      authorId,
      recipientId,
      text,
      existing,
    });
  }

  protected async execute(
    { campaignId, recipientId, text }: Input,
    { campaign, at, authorId, existing }: Loaded,
    uow: UnitOfWork,
  ) {
    let review = existing;
    if (review) {
      const overwritten = review.overwrite(text, at);
      if (!overwritten.ok) return overwritten;
    } else {
      const created = ReviewAr.create(
        {
          uuid: crypto.randomUUID(),
          campaignId,
          scopeId: campaign.scopeId,
          authorId,
          recipientId,
          text,
          ...new ReviewDraftDqs(campaign).of(authorId, recipientId),
        },
        at,
      );
      if (!created.ok) return created;
      review = created.value;
    }
    uow.register(review, this.resolve.reviews);
    return ok({ reviewId: review.uuid, campaignId, recipientId });
  }
}
