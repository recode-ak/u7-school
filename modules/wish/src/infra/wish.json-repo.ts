import type { WishState, WishStatus, WishTargetVo } from '@u7-scl/domain/wish';
import { WishAr, WishArDef } from '@u7-scl/domain/wish';
import { assertVersion, Lock } from 'dmg-core/app';
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
export class WishJsonRepo implements WishRepo {
  readonly aggregate = WishArDef;
  private readonly lock = new Lock();

  constructor(private readonly filePath: string) {}

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

  async findCurrentByUserAndTarget(
    userId: string,
    target: WishTargetVo,
  ): Promise<WishAr | undefined> {
    const matches = await this.findAllByUserAndTarget(userId, target);
    // При равных createdAt порядок записей недетерминирован, поэтому
    // сначала сужаем выборку до активных желаний (релевантных для
    // потребителей: отмена, экран W04, ER-реакции), и только среди
    // них берём последнее созданное.
    const active = matches.filter((w) => w.isActive());
    const pool = active.length > 0 ? active : matches;
    pool.sort((a, b) => b.snapshot().createdAt - a.snapshot().createdAt);
    return pool[0];
  }

  async findByUser(userId: string): Promise<WishAr[]> {
    return this.where((r) => r.userId === userId);
  }

  async findAllByKind(
    kind: 'course' | 'module',
    statuses?: WishStatus[],
  ): Promise<WishAr[]> {
    return this.where(
      (r) =>
        r.target.kind === kind && (!statuses || statuses.includes(r.status)),
    );
  }

  save(ar: WishAr): Promise<void> {
    return this.lock.run(async () => {
      const rows = await this.rows();
      const stored = rows.find((r) => r.uuid === ar.uuid);
      assertVersion(this.aggregate, ar, stored);
      const next = rows.filter((r) => r.uuid !== ar.uuid);
      next.push(ar.snapshot());
      await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
    });
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
