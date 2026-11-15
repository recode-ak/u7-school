import {
  ReviewCampaignAr,
  ReviewCampaignArDef,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import {
  type StoredRecord,
  VersionConflict,
  VersionedRepository,
} from 'dmg-core/app';
import * as v from 'valibot';
import type { ReviewCampaignRepo } from '../review-campaign/review-campaign.repo';

const Rows = v.array(ReviewCampaignArDef.state);

/**
 * Кампании отзывов в JSON-файле: массив снапшотов. Только хранение — запись
 * разбирает `ReviewCampaignArDef.state` (он же дописывает `updatedAt`/`version`, D-36), агрегат восстанавливает
 * `ReviewCampaignAr.restore`. Битая запись — исключение, файл не
 * читается и не перезаписывается. Запись — под замком.
 *
 * Ключ окна (скоуп, субъект) уникален: штатный отказ даёт правило `unique`,
 * дубль на записи — гонка двух создателей, оба прошли правило, —
 * `VersionConflict` (UoW вернёт `VERSION_CONFLICT`).
 */
export class ReviewCampaignJsonRepo
  extends VersionedRepository<ReviewCampaignAr>
  implements ReviewCampaignRepo
{
  readonly aggregate = ReviewCampaignArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<ReviewCampaignAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && ReviewCampaignAr.restore(row);
  }

  async findBySubject(
    scopeId: string,
    subjectId: string,
  ): Promise<ReviewCampaignAr | undefined> {
    const row = (await this.rows()).find(
      (r) => r.scopeId === scopeId && r.subjectId === subjectId,
    );
    return row && ReviewCampaignAr.restore(row);
  }

  async findActiveBySubject(
    userId: string,
    at: number,
  ): Promise<ReviewCampaignAr[]> {
    return this.where((r) => r.subjectId === userId && at < r.expiresAt);
  }

  async findActiveByMentor(
    userId: string,
    at: number,
  ): Promise<ReviewCampaignAr[]> {
    return this.where((r) => r.payload.mentorId === userId && at < r.expiresAt);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: ReviewCampaignAr): Promise<void> {
    const state = ar.snapshot();
    const others = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    if (
      others.some(
        (r) => r.scopeId === state.scopeId && r.subjectId === state.subjectId,
      )
    ) {
      throw new VersionConflict(this.aggregate, ar.uuid);
    }
    others.push(state);
    await Bun.write(this.filePath, JSON.stringify(others, undefined, 2));
  }

  private async where(
    match: (row: ReviewCampaignState) => boolean,
  ): Promise<ReviewCampaignAr[]> {
    return (await this.rows()).filter(match).map(ReviewCampaignAr.restore);
  }

  private async rows(): Promise<ReviewCampaignState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
