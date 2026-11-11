import { errConflict } from '@u7-scl/core/domain';
import type { TelegramIdTakenUcError, User } from '@u7-scl/domain/user';
import {
  type CreateUserCmd,
  type CreateUserCmdMeta,
  CreateUserCmdSchema,
  LegacyUserAr,
  LegacyUserPolicy,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case создания пользователя.
 * Требует прав ADMIN.
 */
export class CreateUserUc extends UserUseCase<CreateUserCmdMeta> {
  protected readonly ucName = 'create-user' as const;
  protected readonly ucLabel = 'Создать пользователя' as const;
  protected readonly arMeta = {
    arName: LegacyUserAr.arName as 'User',
    arLabel: LegacyUserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateUserCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: CreateUserCmd, actor: User): Promise<User> {
    const repo = this.resolve.userRepo;

    if (!LegacyUserPolicy.canCreate(actor)) {
      this.throwAccessDenied('Недостаточно прав для создания пользователя');
    }

    // Проверка уникальности telegramId
    if (await repo.isTelegramIdTaken(command.telegramId)) {
      this.throwError(
        errConflict<TelegramIdTakenUcError>(
          'TELEGRAM_ID_TAKEN',
          'Пользователь с таким telegramId уже существует',
          { telegramId: command.telegramId },
        ),
      );
    }

    const ar = LegacyUserAr.create(command);
    await repo.save(ar.state);

    return ar.state;
  }
}
