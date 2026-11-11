import type { User } from '@u7-scl/domain/user';
import {
  LegacyUserAr,
  type RegisterGuestCmd,
  type RegisterGuestCmdMeta,
  RegisterGuestCmdSchema,
  Role,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '../user-uc';

/**
 * Регистрация нового пользователя с ролью GUEST.
 * Если пользователь уже существует, возвращает его текущее состояние без изменений.
 */
export class RegisterGuestUc extends UserUseCase<RegisterGuestCmdMeta> {
  protected readonly ucName = 'register-guest' as const;
  protected readonly ucLabel = 'Зарегистрировать гостя' as const;
  protected readonly arMeta = {
    arName: 'User' as const,
    arLabel: 'Пользователь' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = RegisterGuestCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: RegisterGuestCmd, actor: User): Promise<User> {
    if (!actor.roles.includes(Role.ADMIN)) {
      this.throwAccessDenied(
        'Только администратор может регистрировать гостей',
      );
    }

    const existing = await this.resolve.userRepo.getByTelegramId(
      command.telegramId,
    );

    if (existing) {
      return existing;
    }

    const ar = LegacyUserAr.register({
      name: command.name,
      telegramId: command.telegramId,
      nick: command.nick,
    });

    await this.resolve.userRepo.save(ar.state);
    return ar.state;
  }
}
