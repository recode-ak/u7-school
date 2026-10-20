import type { User } from '@u7-scl/domain/user';
import {
  type RemoveRoleToUserCmd,
  type RemoveRoleToUserCmdMeta,
  RemoveRoleToUserCmdSchema,
  UserAr,
  UserPolicy,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case удаления роли у пользователя.
 * ADMIN может удалить любую роль. Обычный пользователь — только STUDENT у себя.
 */
export class RemoveRoleToUserUc extends UserUseCase<RemoveRoleToUserCmdMeta> {
  protected readonly ucName = 'remove-role-to-user' as const;
  protected readonly ucLabel = 'Удалить роль у пользователя' as const;
  protected readonly arMeta = {
    arName: UserAr.arName as 'User',
    arLabel: UserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = RemoveRoleToUserCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: RemoveRoleToUserCmd, actor: User): Promise<User> {
    const repo = this.resolve.userRepo;

    const target = await repo.getByUuid(command.userId);
    if (!target) {
      this.throwNotFound('USER_NOT_FOUND', 'Пользователь не найден', {
        uuid: command.userId,
      });
    }

    if (!UserPolicy.canRemoveRole(actor, target, command.role)) {
      this.throwAccessDenied('Недостаточно прав для выполнения действия');
    }

    const ar = new UserAr(target);
    ar.removeRole(command.role);
    await repo.save(ar.state);

    return ar.state;
  }
}
