import { errNotFound } from '@u7-scl/core/domain';
import type { User, UserNotFoundUcError } from '@u7-scl/domain/user';
import {
  type GetUserByTelegramIdCmd,
  type GetUserByTelegramIdCmdMeta,
  GetUserByTelegramIdCmdSchema,
  LegacyUserAr,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case поиска пользователя по Telegram ID.
 * Доступно всем (checkPolicy — пустая реализация).
 */
export class GetUserByTelegramIdUc extends UserUseCase<GetUserByTelegramIdCmdMeta> {
  protected readonly ucName = 'get-user-by-telegram-id' as const;
  protected readonly ucLabel = 'Найти пользователя по Telegram ID' as const;
  protected readonly arMeta = {
    arName: LegacyUserAr.arName as 'User',
    arLabel: LegacyUserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetUserByTelegramIdCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: GetUserByTelegramIdCmd): Promise<User> {
    const user = await this.resolve.userRepo.getByTelegramId(
      command.telegramId,
    );
    if (!user) {
      this.throwError(
        errNotFound<UserNotFoundUcError>(
          'USER_NOT_FOUND',
          'Пользователь не найден',
          {
            telegramId: command.telegramId,
          },
        ),
      );
    }
    return user;
  }
}
