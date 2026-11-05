import { ModuleAr, ModuleArDef, type ModuleState } from '@u7-scl/domain/course';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { ModuleFilter, ModuleRepo } from '../module/module.repo';

const Rows = v.array(ModuleArDef.state);

/** Сравнение строк по кодам символов — порядок legacy `getAll`. */
const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Модули в JSON-файле: массив снапшотов. Только хранение — запись разбирает
 * `ModuleArDef.state`, битая запись — исключение, файл не перезаписывается.
 */
export class ModuleJsonRepo
  extends VersionedRepository<ModuleAr>
  implements ModuleRepo
{
  readonly aggregate = ModuleArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<ModuleAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && ModuleAr.restore(row);
  }

  async findAll(filter: ModuleFilter = {}): Promise<ModuleAr[]> {
    let modules = await this.rows();
    const { status, authorId, title, tags } = filter;

    if (status) modules = modules.filter((r) => r.status === status);
    if (authorId) modules = modules.filter((r) => r.authorId === authorId);
    if (title) {
      const lower = title.toLowerCase();
      modules = modules.filter((r) => r.title.toLowerCase().includes(lower));
    }
    if (tags && tags.length > 0) {
      modules = modules.filter((r) => r.tags?.some((t) => tags.includes(t)));
    }
    modules = this.sorted(modules, filter.sort);
    if (filter.limit !== undefined) {
      modules = modules.slice(0, filter.limit);
    }

    return modules.map(ModuleAr.restore);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: ModuleAr): Promise<void> {
    const rows = await this.rows();
    const snapshot = ar.snapshot();
    const at = rows.findIndex((r) => r.uuid === ar.uuid);
    if (at === -1) rows.push(snapshot);
    else rows[at] = snapshot;
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
  }

  /** Поле сортировки из строки `field:dir`; неизвестное — порядок не меняется. */
  private sorted(rows: ModuleState[], sort?: string): ModuleState[] {
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

  private async rows(): Promise<ModuleState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
