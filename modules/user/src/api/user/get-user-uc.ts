import type { User } from '@u7-scl/domain/user';
import {
  type GetUserCmd,
  type GetUserCmdMeta,
  GetUserCmdSchema,
  LegacyUserAr,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case получения пользователя по UUID.
 * Доступно всем (checkPolicy — пустая реализация).
 */
export class GetUserUc extends UserUseCase<GetUserCmdMeta> {
  protected readonly ucName = 'get-user' as const;
  protected readonly ucLabel = 'Получить пользователя по UUID' as const;
  protected readonly arMeta = {
    arName: LegacyUserAr.arName as 'User',
    arLabel: LegacyUserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetUserCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: GetUserCmd): Promise<User> {
    const user = await this.resolve.userRepo.getByUuid(command.uuid);
    if (!user) {
      this.throwNotFound('USER_NOT_FOUND', 'Пользователь не найден', {
        uuid: command.uuid,
      });
    }
    return user;
  }
}
