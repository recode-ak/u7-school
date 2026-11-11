import { UserAr, UserArDef } from '@u7-scl/domain/user';
import { type StoredRecord, VersionedRepository } from 'dmg-core/app';
import * as v from 'valibot';
import type { UserFilter, UserRepo } from '../user/user.repo';

/**
 * Схема файла: разбирает только Def агрегата (D-36) — он же дописывает
 * `updatedAt`/`version` legacy-записям и переводит ISO-даты в числа (DOM-01).
 */
const Rows = v.array(UserArDef.state);

type Row = v.InferOutput<typeof Rows>[number];

/** Порядок legacy: `<`/`>` по значению поля, `dir` меняет знак. */
function comparator(sort: string): (a: Row, b: Row) => number {
  const sign = sort.endsWith(':asc') ? 1 : -1;
  if (sort.startsWith('name')) {
    return (a, b) => sign * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  }
  return (a, b) => sign * (a.createdAt - b.createdAt);
}

/**
 * Пользователи в JSON-файле: массив снапшотов. Только хранение — запись
 * разбирает `UserArDef.state`, агрегат восстанавливает `UserAr.restore`.
 * Битая запись — исключение, файл не перезаписывается. Запись — под замком:
 * чтение → сверка версии → запись атомарны в процессе.
 */
export class UserJsonRepo
  extends VersionedRepository<UserAr>
  implements UserRepo
{
  readonly aggregate = UserArDef;

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(uuid: string): Promise<UserAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && UserAr.restore(row);
  }

  async findByTelegramId(telegramId: number): Promise<UserAr | undefined> {
    const row = (await this.rows()).find((r) => r.telegramId === telegramId);
    return row && UserAr.restore(row);
  }

  async findByIds(uuids: string[]): Promise<UserAr[]> {
    const wanted = new Set(uuids);
    return this.where((r) => wanted.has(r.uuid));
  }

  async findAll(filter: UserFilter = {}): Promise<UserAr[]> {
    const rows = await this.matching(filter);
    const limited =
      filter.limit === undefined ? rows : rows.slice(0, filter.limit);
    return limited.map(UserAr.restore);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: UserAr): Promise<void> {
    const next = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    next.push(ar.snapshot());
    await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
  }

  private async where(match: (row: Row) => boolean): Promise<UserAr[]> {
    return (await this.rows()).filter(match).map(UserAr.restore);
  }

  /** Записи по фильтру и в порядке сортировки; лимит применяет вызывающий. */
  private async matching(filter: UserFilter): Promise<Row[]> {
    const { role } = filter;
    const { name } = filter;
    const { sort } = filter;
    let rows = await this.rows();
    if (role !== undefined) rows = rows.filter((r) => r.roles.includes(role));
    if (filter.telegramId !== undefined) {
      rows = rows.filter((r) => r.telegramId === filter.telegramId);
    }
    if (name !== undefined) {
      const wanted = name.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(wanted));
    }
    if (sort !== undefined) rows.sort(comparator(sort));
    return rows;
  }

  private async rows(): Promise<Row[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
