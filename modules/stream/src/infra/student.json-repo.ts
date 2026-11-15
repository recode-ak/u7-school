import {
  StudentAr,
  StudentArDef,
  type StudentState,
} from '@u7-scl/domain/stream';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { StudentRepo } from '../student/student.repo';

const Rows = v.array(StudentArDef.state);

/**
 * Студенты в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `StudentArDef.state` (он же переводит ISO-даты legacy в числа и дописывает
 * `updatedAt`/`version`, D-36), агрегат восстанавливает `StudentAr.restore`.
 * Битая запись — исключение, файл не перезаписывается. Первая запись
 * переписывает весь файл в новом формате.
 */
export class StudentJsonRepo
  extends VersionedRepository<StudentAr>
  implements StudentRepo
{
  readonly aggregate = StudentArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<StudentAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && StudentAr.restore(row);
  }

  async findByStream(streamId: string): Promise<StudentAr[]> {
    return this.select((r) => r.streamId === streamId);
  }

  async findByUser(userId: string): Promise<StudentAr[]> {
    return this.select((r) => r.userId === userId);
  }

  async findStudying(): Promise<StudentAr[]> {
    const all = await this.select(() => true);
    return all.filter((student) => student.isInProgress());
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: StudentAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  private async select(
    predicate: (row: StudentState) => boolean,
  ): Promise<StudentAr[]> {
    return (await this.rows()).filter(predicate).map(StudentAr.restore);
  }

  private async rows(): Promise<StudentState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
