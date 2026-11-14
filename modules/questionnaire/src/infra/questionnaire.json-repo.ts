import {
  QuestionnaireAr,
  QuestionnaireArDef,
  type QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type {
  QuestionnaireFilter,
  QuestionnaireIdle,
  QuestionnaireRepo,
} from '../questionnaire/questionnaire.repo';

const Rows = v.array(QuestionnaireArDef.state);

/**
 * Анкеты в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `QuestionnaireArDef.state` (он же переводит ISO-даты legacy в числа и
 * дописывает `updatedAt`/`version`, D-36), агрегат восстанавливает
 * `QuestionnaireAr.restore`. Битая запись — исключение, файл не
 * перезаписывается. Первая запись переписывает весь файл в новом формате.
 */
export class QuestionnaireJsonRepo
  extends VersionedRepository<QuestionnaireAr>
  implements QuestionnaireRepo
{
  readonly aggregate = QuestionnaireArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<QuestionnaireAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && QuestionnaireAr.restore(row);
  }

  async findByRespondent(
    userId: string,
    { status, kind, courseId }: QuestionnaireFilter = {},
  ): Promise<QuestionnaireAr[]> {
    return (await this.rows())
      .filter(
        (r) =>
          r.respondentId === userId &&
          (status === undefined || r.status === status) &&
          (kind === undefined || r.kind === kind) &&
          (courseId === undefined || r.ownerInfo.courseId === courseId),
      )
      .map(QuestionnaireAr.restore);
  }

  async findIdle({
    idleMs,
    at,
    kinds,
  }: QuestionnaireIdle): Promise<QuestionnaireAr[]> {
    const rows = (await this.rows()).filter(
      (r) =>
        (r.status === 'invited' || r.status === 'in_progress') &&
        (kinds === undefined || kinds.includes(r.kind)),
    );
    return rows
      .map(QuestionnaireAr.restore)
      .filter((ar) => ar.idleFor(at) >= idleMs);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: QuestionnaireAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  private async rows(): Promise<QuestionnaireState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
