import {
  CampaignFactsDqs,
  GetCampaignRecipientsUcDef,
  type PeerReviewModuleDef,
  type ReviewCampaignAr,
  ReviewCampaignErrors,
  ReviewCampaignPolicy,
} from '@u7-scl/domain/peer-review';
import { type Caller, CoreErrors, err, type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

/** Загруженное — контекст Policy `isWindowAuthor`. */
type Loaded = { readonly campaign: ReviewCampaignAr };

type Input = ParsedInputOf<typeof GetCampaignRecipientsUcDef>;

/**
 * Адресаты автора в окне (ФР-7): кампанию и отзывы автора добывает UC, роль и
 * адресатов — Ar и `CampaignFactsDqs`. Автор — субъект вызова; кому не
 * положено — отказ Policy.
 */
export class GetCampaignRecipientsUc extends UseCaseFromDef<
  typeof GetCampaignRecipientsUcDef,
  PeerReviewDeps,
  Loaded,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(GetCampaignRecipientsUcDef, deps, module);
  }

  /** Кампания по `campaignId`; нет — `REVIEW_CAMPAIGN_NOT_FOUND`. */
  protected async load({ campaignId }: Input) {
    const campaign = await this.resolve.campaigns.findById(campaignId);
    if (campaign) return ok({ campaign });
    return err(ReviewCampaignErrors.NOT_FOUND.make({ campaignId }));
  }

  protected async execute(
    { campaignId }: Input,
    { campaign }: Loaded,
    _: unknown,
    caller: Caller<Identified>,
  ) {
    const userId = this.subject(caller).uuid;
    const myRole = campaign.authorRoleOf(userId);
    // Policy пропускает только автора окна; ветка сужает тип и дублирует отказ.
    if (myRole === undefined) {
      return CoreErrors.ACCESS_DENIED.err({
        rule: 'isWindowAuthor',
        denyMessage: ReviewCampaignPolicy.rules.isWindowAuthor.denyMessage,
      });
    }
    const myReviews = await this.resolve.reviews.findByCampaignAndAuthor(
      campaignId,
      userId,
    );
    return ok({
      campaignId,
      context: campaign.view().context,
      myRole,
      mentorId: campaign.mentorId,
      // Исход субъекта окна — тексты S03/S05 по парам «роль-судьба»
      subjectOutcome: campaign.subjectOutcome,
      daysLeft: campaign.daysLeft(this.now()),
      recipients: new CampaignFactsDqs(
        campaign,
        myReviews,
      ).recipientsWithMyReview(userId),
    });
  }
}
