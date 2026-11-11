import type { User } from '@u7-scl/domain/user';
import {
  type AddRoleToUserCmd,
  type AddRoleToUserCmdMeta,
  AddRoleToUserCmdSchema,
  LegacyUserAr,
  LegacyUserPolicy,
  UserSchema,
} from '@u7-scl/domain/user';
import { UserUseCase } from '#api-legacy/user-uc';

/**
 * Use-case добавления роли пользователю.
 * Требует прав ADMIN.
 */
export class AddRoleToUserUc extends UserUseCase<AddRoleToUserCmdMeta> {
  protected readonly ucName = 'add-role-to-user' as const;
  protected readonly ucLabel = 'Добавить роль пользователю' as const;
  protected readonly arMeta = {
    arName: LegacyUserAr.arName as 'User',
    arLabel: LegacyUserAr.arLabel as 'Пользователь',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = AddRoleToUserCmdSchema;
  protected readonly outputSchema = UserSchema;

  async execute(command: AddRoleToUserCmd, actor: User): Promise<User> {
    const repo = this.resolve.userRepo;

    const target = await repo.getByUuid(command.userId);
    if (!target) {
      this.throwNotFound('USER_NOT_FOUND', 'Пользователь не найден', {
        uuid: command.userId,
      });
    }

    if (!LegacyUserPolicy.canAddRole(actor, target, command.role)) {
      this.throwAccessDenied('Недостаточно прав для выполнения действия');
    }

    const ar = new LegacyUserAr(target);
    ar.addRole(command.role);
    await repo.save(ar.state);

    return ar.state;
  }
}
