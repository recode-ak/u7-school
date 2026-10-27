import {
  type StoredRecord,
  VersionedRepository,
} from '#core/app/uow/repository';
import { UserAr, UserArDef } from '#core/testing/example/users/index';
import type { UserState } from '#core/testing/example/users/user/user.state';
import type { UserRepo } from '../user/user.repo';

/** Пользователи в памяти: снапшоты по uuid. */
export class UserMemoryRepo
  extends VersionedRepository<UserAr>
  implements UserRepo
{
  readonly aggregate = UserArDef;
  private readonly rows = new Map<string, UserState>();

  constructor(rows: readonly UserState[] = []) {
    super();
    for (const row of rows) this.rows.set(row.uuid, row);
  }

  async findById(uuid: string): Promise<UserAr | undefined> {
    const row = this.rows.get(uuid);
    return row && UserAr.restore(row);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return this.rows.get(uuid);
  }

  protected async write(ar: UserAr): Promise<void> {
    this.rows.set(ar.uuid, ar.snapshot());
  }
}
