import {
  ReviewCampaignAr,
  ReviewCampaignArDef,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import { MemoryRepo } from 'dmg-core/testing';
import type { ReviewCampaignRepo } from './review-campaign.repo';

/**
 * Фейк порта `ReviewCampaignRepo` для тестов UC/ER: запись — память базы,
 * `findBySubject` — по снимкам из памяти, выборки с окном времени — ответ
 * задаёт тест присваиванием поля.
 */
export class ReviewCampaignRepoFake
  extends MemoryRepo<ReviewCampaignAr, ReviewCampaignState>
  implements ReviewCampaignRepo
{
  constructor() {
    super(ReviewCampaignArDef, ReviewCampaignAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findBySubject = async (scopeId: string, subjectId: string) =>
    this.where((s) => s.scopeId === scopeId && s.subjectId === subjectId)[0];
  findActiveBySubject = this.unanswered<
    [userId: string, at: number],
    ReviewCampaignAr[]
  >('findActiveBySubject');
  findActiveByMentor = this.unanswered<
    [userId: string, at: number],
    ReviewCampaignAr[]
  >('findActiveByMentor');
}
