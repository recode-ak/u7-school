import type { WishState, WishTargetVo } from '@u7-scl/domain/wish';
import { WishAr, WishArDef } from '@u7-scl/domain/wish';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { WishRepo } from '../wish/wish.repo';

const Rows = v.array(WishArDef.state);

/** Проверяет равенство целей желания (сравнение по варианту и его ключам). */
function isSameTarget(a: WishTargetVo, b: WishTargetVo): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'course' && b.kind === 'course') {
    return a.courseId === b.courseId;
  }
  if (a.kind === 'module' && b.kind === 'module') {
    return a.moduleId === b.moduleId;
  }
  return false;
}

/**
 * Желания в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `WishArDef.state` (он же дописывает `updatedAt`/`version` legacy-записям,
 * D-36), агрегат восстанавливает `WishAr.restore`. Битая запись — исключение,
 * файл не перезаписывается. Запись — под замком: чтение → сверка версии →
 * запись атомарны в процессе.
 */
export class WishJsonRepo
  extends VersionedRepository<WishAr>
  implements WishRepo
{
  readonly aggregate = WishArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<WishAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && WishAr.restore(row);
  }

  async findAllByUserAndTarget(
    userId: string,
    target: WishTargetVo,
  ): Promise<WishAr[]> {
    return this.where(
      (r) => r.userId === userId && isSameTarget(r.target, target),
    );
  }

  async findByUser(userId: string): Promise<WishAr[]> {
    return this.where((r) => r.userId === userId);
  }

  async findAllByKind(kind: 'course' | 'module'): Promise<WishAr[]> {
    return this.where((r) => r.target.kind === kind);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: WishAr): Promise<void> {
    const next = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    next.push(ar.snapshot());
    await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
  }

  private async where(match: (row: WishState) => boolean): Promise<WishAr[]> {
    return (await this.rows()).filter(match).map(WishAr.restore);
  }

  private async rows(): Promise<WishState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
