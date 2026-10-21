import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { ok } from '#core/kernel/result/result';
import type { UsersDeps } from '#core/testing/example/app/users/users.module';
import {
  RemoveUserUcDef,
  type UserAr,
  UserErrors,
  type UsersModuleDef,
} from '#core/testing/example/users/index';

type Loaded = { readonly user: UserAr };

export class RemoveUserUc extends UseCaseFromDef<
  typeof RemoveUserUcDef,
  UsersDeps,
  Loaded
> {
  constructor(deps: UsersDeps, module: typeof UsersModuleDef) {
    super(RemoveUserUcDef, deps, module);
  }

  protected async load({ userId }: { userId: string }) {
    const user = await this.resolve.users.findById(userId);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ userId });
  }

  protected async execute(_: unknown, { user }: Loaded, uow: UnitOfWork) {
    const res = user.remove(this.now());
    if (!res.ok) return res;
    uow.register(user, this.resolve.users);
    return ok({});
  }
}
