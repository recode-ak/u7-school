import { StreamAr, StreamArDef, type StreamState } from '@u7-scl/domain/stream';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { StreamFilter, StreamRepo } from '../stream/stream.repo';

const Rows = v.array(StreamArDef.state);

/**
 * Потоки в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `StreamArDef.state` (он же дописывает
 * `updatedAt`/`version`, D-36), агрегат восстанавливает `StreamAr.restore`.
 * Битая запись — исключение, файл не перезаписывается. Первая запись
 * переписывает весь файл в новом формате.
 */
export class StreamJsonRepo
  extends VersionedRepository<StreamAr>
  implements StreamRepo
{
  readonly aggregate = StreamArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<StreamAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && StreamAr.restore(row);
  }

  async findAll(filter: StreamFilter = {}): Promise<StreamAr[]> {
    return (await this.rows())
      .filter(
        (r) =>
          (!filter.status || r.status === filter.status) &&
          (!filter.mentorId || r.mentorId === filter.mentorId) &&
          (!filter.schoolId || r.schoolId === filter.schoolId),
      )
      .map(StreamAr.restore);
  }

  async findByTelegramGroup(
    telegramGroupId: string,
  ): Promise<StreamAr | undefined> {
    const row = (await this.rows()).find(
      (r) => r.telegramGroupId === telegramGroupId,
    );
    return row && StreamAr.restore(row);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: StreamAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  private async rows(): Promise<StreamState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
