import {
  ReviewAr,
  ReviewArDef,
  type ReviewFilter,
  type ReviewState,
} from '@u7-scl/domain/peer-review';
import { MemoryRepo } from 'dmg-core/testing';
import type { ReviewRepo } from './review.repo';

/**
 * Фейк порта `ReviewRepo` для тестов UC/ER: запись — память базы, `findById`
 * и простые выборки — по снимкам из памяти, выборки с фильтром — ответ
 * задаёт тест присваиванием поля.
 */
export class ReviewRepoFake
  extends MemoryRepo<ReviewAr, ReviewState>
  implements ReviewRepo
{
  constructor() {
    super(ReviewArDef, ReviewAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByPair = async (
    campaignId: string,
    authorId: string,
    recipientId: string,
  ) =>
    this.where(
      (s) =>
        s.campaignId === campaignId &&
        s.authorId === authorId &&
        s.recipientId === recipientId,
    )[0];
  findByCampaignAndAuthor = async (campaignId: string, authorId: string) =>
    this.where((s) => s.campaignId === campaignId && s.authorId === authorId);
  findByScope = async (scopeId: string) =>
    this.where((s) => s.scopeId === scopeId);
  findByScopes = this.unanswered<
    [scopeIds: readonly string[], filter?: ReviewFilter],
    ReviewAr[]
  >('findByScopes');
  findByRecipient = this.unanswered<
    [recipientId: string, filter?: ReviewFilter],
    ReviewAr[]
  >('findByRecipient');
}
