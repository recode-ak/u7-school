import {
  RemoveRoleFromUserUcDef,
  type UserAr,
  UserErrors,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { ok, type ReadonlyAr } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof RemoveRoleFromUserUcDef>;

/** Загруженное — контекст Policy `canManageRoles` и операции Ar. */
type Loaded = { readonly user: UserAr };

export class RemoveRoleFromUserUc extends UseCaseFromDef<
  typeof RemoveRoleFromUserUcDef,
  UserDeps,
  Loaded,
  ReadonlyAr<UserAr>
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(RemoveRoleFromUserUcDef, deps, module);
  }

  /** Нет пользователя — `USER_NOT_FOUND` до проверки права (порядок legacy). */
  protected async load({ userId }: Input) {
    const user = await this.resolve.users.findById(userId);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ uuid: userId });
  }

  protected async execute({ role }: Input, { user }: Loaded, uow: UnitOfWork) {
    const removed = user.removeRole(role, this.now());
    if (!removed.ok) return removed;
    uow.register(user, this.resolve.users);
    return ok(user.view());
  }
}
