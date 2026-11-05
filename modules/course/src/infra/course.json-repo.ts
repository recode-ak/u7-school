import { CourseAr, CourseArDef, type CourseState } from '@u7-scl/domain/course';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { CourseFilter, CourseRepo } from '../course/course.repo';

const Rows = v.array(CourseArDef.state);

/** Сравнение строк по кодам символов — порядок legacy `getAll`. */
const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Курсы в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `CourseArDef.state`, инвариант программы проверяет `CourseAr.restore`;
 * битая запись — исключение, файл не перезаписывается.
 */
export class CourseJsonRepo
  extends VersionedRepository<CourseAr>
  implements CourseRepo
{
  readonly aggregate = CourseArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<CourseAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && CourseAr.restore(row);
  }

  /** Порядок — файла: неизвестные uuid и повторы в запросе отбрасываются. */
  async findByIds(uuids: readonly string[]): Promise<CourseAr[]> {
    if (uuids.length === 0) return [];
    const wanted = new Set(uuids);
    return (await this.rows())
      .filter((r) => wanted.has(r.uuid))
      .map(CourseAr.restore);
  }

  async findAll(filter: CourseFilter = {}): Promise<CourseAr[]> {
    let courses = await this.rows();
    const { status, authorId, title } = filter;

    if (status) courses = courses.filter((r) => r.status === status);
    if (authorId) courses = courses.filter((r) => r.authorId === authorId);
    if (title) {
      const lower = title.toLowerCase();
      courses = courses.filter((r) => r.title.toLowerCase().includes(lower));
    }
    courses = this.sorted(courses, filter.sort);
    if (filter.limit !== undefined) {
      courses = courses.slice(0, filter.limit);
    }

    return courses.map(CourseAr.restore);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: CourseAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  /** Поле сортировки из строки `field:dir`; неизвестное — порядок не меняется. */
  private sorted(rows: CourseState[], sort?: string): CourseState[] {
    const [field, direction] = (sort ?? '').split(':');
    const sign = direction === 'asc' ? 1 : -1;
    if (field === 'title') {
      return [...rows].sort((a, b) => sign * compareText(a.title, b.title));
    }
    if (field === 'createdAt') {
      return [...rows].sort((a, b) => sign * (a.createdAt - b.createdAt));
    }
    return rows;
  }

  private async rows(): Promise<CourseState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
