import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { ok } from '#core/kernel/result/result';
import type { UsersDeps } from '#core/testing/example/app/users/users.module';
import {
  GetUserUcDef,
  type UserAr,
  UserErrors,
  type UsersModuleDef,
} from '#core/testing/example/users/index';

type Loaded = { readonly user: UserAr };

/** Ответ для других модулей: активна ли учётная запись — решает `UserAr`. */
export class GetUserUc extends UseCaseFromDef<
  typeof GetUserUcDef,
  UsersDeps,
  Loaded
> {
  constructor(deps: UsersDeps, module: typeof UsersModuleDef) {
    super(GetUserUcDef, deps, module);
  }

  protected async load({ userId }: { userId: string }) {
    const user = await this.resolve.users.findById(userId);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ userId });
  }

  protected async execute(_: unknown, { user }: Loaded, __: UnitOfWork) {
    return ok({ userId: user.uuid, active: user.isActive() });
  }
}
