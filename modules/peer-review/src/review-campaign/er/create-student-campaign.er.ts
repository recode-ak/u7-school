import {
  CreateStudentCampaignErDef,
  type PeerReviewModuleDef,
  ReviewCampaignAr,
  ReviewCampaignRules,
  StudentFateDqs,
} from '@u7-scl/domain/peer-review';
import {
  GetStreamMembersUcDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { ok, type SystemCaller } from 'dmg-core';
import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
  type Trace,
  type UnitOfWork,
} from 'dmg-core/app';
import type { PeerReviewDeps } from '../../peer-review.module';

type Def = typeof CreateStudentCampaignErDef;

/**
 * Создание кампании по судьбе студента: кампания пары (поток, студент) уже
 * есть — успех без записи (идемпотентность); состав потока недоступен —
 * предупреждение и выход без кампании. Исход и адресатов считает
 * `StudentFateDqs`, кампанию создаёт `ReviewCampaignAr.create`.
 */
export class CreateStudentCampaignEr extends ReactionFromDef<
  Def,
  PeerReviewDeps
> {
  constructor(deps: PeerReviewDeps, module: typeof PeerReviewModuleDef) {
    super(CreateStudentCampaignErDef, deps, module);
  }

  protected async react(
    event: ReactionEnvelopeOf<Def>,
    uow: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    const scopeId = event.payload.streamId;
    const subjectId = event.payload.userId;
    const { campaigns } = this.resolve;

    // Идемпотентность: правило `unique` отказывает — это успех, не ошибка.
    const existing = await campaigns.findBySubject(scopeId, subjectId);
    const unique = ReviewCampaignRules.rules.unique.check({
      scopeId,
      subjectId,
      campaigns: existing ? [existing] : [],
    });
    if (!unique.ok) return ok();

    const members = await this.call(
      GetStreamMembersUcDef,
      { streamId: scopeId },
      caller,
      trace,
    );
    if (!members.ok) return members;
    if (!members.value) {
      this.resolve.app.logger.warn(
        this.def.name,
        'Состав потока недоступен — кампания не создана',
        { scopeId, subjectId },
      );
      return ok();
    }

    const fates = new StudentFateDqs(members.value);
    const fate =
      event.name === StudentEvents.completed.name
        ? fates.forCompleted(event.payload)
        : fates.forAbandoned(event.payload);

    const created = ReviewCampaignAr.create(
      {
        uuid: crypto.randomUUID(),
        scopeId,
        subjectId,
        mentorId: members.value.mentorId,
        subjectOutcome: fate.outcome,
        participantIds: fate.participantIds,
      },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, campaigns);
    return ok();
  }
}
