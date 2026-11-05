import { StepAr, StepArDef, type StepState } from '@u7-scl/domain/course';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { StepRepo } from '../step/step.repo';

const Rows = v.array(StepArDef.state);

/**
 * Шаги в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `StepArDef.state`, битая запись — исключение, файл не перезаписывается.
 */
export class StepJsonRepo
  extends VersionedRepository<StepAr>
  implements StepRepo
{
  readonly aggregate = StepArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<StepAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && StepAr.restore(row);
  }

  async findByIds(ids: readonly string[]): Promise<StepAr[]> {
    const wanted = new Set(ids);
    return (await this.rows())
      .filter((r) => wanted.has(r.uuid))
      .map(StepAr.restore);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: StepAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  private async rows(): Promise<StepState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
