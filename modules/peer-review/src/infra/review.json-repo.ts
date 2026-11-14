import {
  ReviewAr,
  ReviewArDef,
  type ReviewFilter,
  type ReviewState,
} from '@u7-scl/domain/peer-review';
import {
  type StoredRecord,
  VersionConflict,
  VersionedRepository,
} from 'dmg-core/app';
import * as v from 'valibot';
import type { ReviewRepo } from '../review/review.repo';

const Rows = v.array(ReviewArDef.state);

/**
 * Отзывы в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `ReviewArDef.state` (он же переводит legacy-даты ISO в число UTC и
 * дописывает `updatedAt`/`version`, D-36), агрегат восстанавливает
 * `ReviewAr.restore`. Битая запись — исключение, файл не читается и
 * не перезаписывается. Запись — под замком.
 *
 * Пара (кампания, автор, адресат) уникальна: штатный повтор — перезапись
 * того же агрегата, дубль с другим uuid — гонка двух создателей, оба прошли
 * правило `unique`, — `VersionConflict` (UoW вернёт `VERSION_CONFLICT`).
 */
export class ReviewJsonRepo
  extends VersionedRepository<ReviewAr>
  implements ReviewRepo
{
  readonly aggregate = ReviewArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<ReviewAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && ReviewAr.restore(row);
  }

  async findByPair(
    campaignId: string,
    authorId: string,
    recipientId: string,
  ): Promise<ReviewAr | undefined> {
    const row = (await this.rows()).find(
      (r) =>
        r.campaignId === campaignId &&
        r.authorId === authorId &&
        r.recipientId === recipientId,
    );
    return row && ReviewAr.restore(row);
  }

  findByCampaignAndAuthor(
    campaignId: string,
    authorId: string,
  ): Promise<ReviewAr[]> {
    return this.where(
      (r) => r.campaignId === campaignId && r.authorId === authorId,
    );
  }

  findByScope(scopeId: string): Promise<ReviewAr[]> {
    return this.where((r) => r.scopeId === scopeId);
  }

  findByScopes(
    scopeIds: readonly string[],
    filter?: ReviewFilter,
  ): Promise<ReviewAr[]> {
    return this.where(
      (r) => scopeIds.includes(r.scopeId) && matches(r, filter),
    );
  }

  findByRecipient(
    recipientId: string,
    filter?: ReviewFilter,
  ): Promise<ReviewAr[]> {
    return this.where(
      (r) => r.recipientId === recipientId && matches(r, filter),
    );
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: ReviewAr): Promise<void> {
    const state = ar.snapshot();
    const others = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    if (
      others.some(
        (r) =>
          r.campaignId === state.campaignId &&
          r.authorId === state.authorId &&
          r.recipientId === state.recipientId,
      )
    ) {
      throw new VersionConflict(this.aggregate, ar.uuid);
    }
    others.push(state);
    await Bun.write(this.filePath, JSON.stringify(others, undefined, 2));
  }

  private async where(
    match: (row: ReviewState) => boolean,
  ): Promise<ReviewAr[]> {
    return (await this.rows()).filter(match).map(ReviewAr.restore);
  }

  private async rows(): Promise<ReviewState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}

/** Фильтр по И; не заданное поле не ограничивает. */
function matches(row: ReviewState, filter?: ReviewFilter): boolean {
  return (
    (filter?.direction === undefined || row.direction === filter.direction) &&
    (filter?.recipientId === undefined ||
      row.recipientId === filter.recipientId) &&
    (filter?.campaignId === undefined || row.campaignId === filter.campaignId)
  );
}
