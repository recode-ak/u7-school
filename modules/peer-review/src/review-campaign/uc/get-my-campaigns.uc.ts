import {
  CampaignFactsDqs,
  GetMyCampaignsUcDef,
  type MyCampaignCard,
  type PeerReviewModuleDef,
  type ReviewCampaignAr,
} from '@u7-scl/domain/peer-review';
import { type Caller, type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Input = ParsedInputOf<typeof GetMyCampaignsUcDef>;

/**
 * Мои кампании (ФР-7): репозиторий добывает открытые окна, где вызывающий —
 * субъект или ментор, факты (роль, остаток, прогресс M/K) считает
 * `CampaignFactsDqs`. Пользователь — из субъекта вызова, часы — приложения.
 */
export class GetMyCampaignsUc extends UseCaseFromDef<
  typeof GetMyCampaignsUcDef,
  PeerReviewDeps,
  undefined,
  Identified
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(GetMyCampaignsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  /** Запрос ничего не пишет: выход — карточки открытых окон. */
  protected async execute(
    { filter }: Input,
    _: undefined,
    __: unknown,
    caller: Caller<Identified>,
  ) {
    const userId = this.subject(caller).uuid;
    const at = this.now();
    const { campaigns, reviews } = this.resolve;

    const own: ReviewCampaignAr[] = [
      ...(await campaigns.findActiveBySubject(userId, at)),
      ...(await campaigns.findActiveByMentor(userId, at)),
    ];
    const selected = own.filter(
      (ar) =>
        (!filter?.context || ar.view().context === filter.context) &&
        (!filter?.scopeId || ar.scopeId === filter.scopeId),
    );

    const cards: MyCampaignCard[] = [];
    for (const ar of selected) {
      const mine = await reviews.findByCampaignAndAuthor(ar.uuid, userId);
      const facts = new CampaignFactsDqs(ar, mine).myFacts(userId, at);
      if (!facts) continue;
      cards.push({
        campaignId: ar.uuid,
        context: ar.view().context,
        scopeId: ar.scopeId,
        subjectId: ar.subjectId,
        expiresAt: ar.expiresAt,
        // Исход субъекта — тексты мини-карточек S02 по парам «роль-судьба»
        subjectOutcome: ar.subjectOutcome,
        ...facts,
      });
    }
    return ok(cards);
  }
}
