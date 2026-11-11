import type { User } from '@u7-scl/domain/user';
import {
  LegacyUserAr,
  type ListUsersCmd,
  type ListUsersCmdMeta,
  ListUsersCmdSchema,
  type ListUsersResult,
  UserSchema,
} from '@u7-scl/domain/user';
import * as v from 'valibot';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case получения списка пользователей с фильтрацией и сортировкой.
 * Доступно всем (checkPolicy — пустая реализация).
 */
export class ListUsersUc extends UserUseCase<ListUsersCmdMeta> {
  protected readonly ucName = 'list-users' as const;
  protected readonly ucLabel =
    'Список всех пользователей с фильтрацией' as const;
  protected readonly arMeta = {
    arName: LegacyUserAr.arName as 'User',
    arLabel: LegacyUserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = ListUsersCmdSchema;
  protected readonly outputSchema = v.object({
    users: v.array(UserSchema),
  });

  async execute(cmd: ListUsersCmd): Promise<ListUsersResult> {
    const users = await this.resolve.userRepo.getAll({
      limit: cmd.limit,
      role: cmd.role as User['roles'][number] | undefined,
      name: cmd.name,
      telegramId: cmd.telegramId,
      sort: cmd.sort,
    });

    return { users };
  }
}
