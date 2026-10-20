import type { UnitOfWork } from '#dmg/app/uow/unit-of-work';
import { UseCaseFromDef } from '#dmg/app/use-case/use-case-from-def';
import { ok } from '#dmg/kernel/result/result';
import type { UsersDeps } from '#dmg/testing/example/app/users/users.module';
import {
  RemoveUserUcDef,
  type UserAr,
  UserErrors,
} from '#dmg/testing/example/users/index';

type Loaded = { readonly user: UserAr };

export class RemoveUserUc extends UseCaseFromDef<
  typeof RemoveUserUcDef,
  UsersDeps,
  Loaded
> {
  constructor(deps: UsersDeps) {
    super(RemoveUserUcDef, deps);
  }

  protected async load({ userId }: { userId: string }) {
    const user = await this.resolve.users.findById(userId);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ userId });
  }

  protected async execute(_: unknown, { user }: Loaded, uow: UnitOfWork) {
    const res = user.remove();
    if (!res.ok) return res;
    uow.register(user, this.resolve.users);
    return ok({});
  }
}
