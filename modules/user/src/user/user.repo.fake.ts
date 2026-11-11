import { UserAr, UserArDef, type UserState } from '@u7-scl/domain/user';
import { MemoryRepo } from 'dmg-core/testing';
import type { UserFilter, UserRepo } from './user.repo';

/**
 * Фейк порта `UserRepo` для тестов UC: запись — память базы, `findById` —
 * по uuid из памяти, выборки — ответ, который задаёт тест присваиванием поля.
 */
export class UserRepoFake
  extends MemoryRepo<UserAr, UserState>
  implements UserRepo
{
  constructor() {
    super(UserArDef, UserAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByTelegramId = this.unanswered<[telegramId: number], UserAr | undefined>(
    'findByTelegramId',
  );
  findByIds = this.unanswered<[uuids: string[]], UserAr[]>('findByIds');
  findAll = this.unanswered<[filter?: UserFilter], UserAr[]>('findAll');
}
