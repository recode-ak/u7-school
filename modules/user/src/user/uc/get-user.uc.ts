import {
  GetUserUcDef,
  type UserAr,
  UserErrors,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof GetUserUcDef>;

/** Загруженное — контекст ответа и источник `USER_NOT_FOUND`. */
type Loaded = { readonly user: UserAr };

export class GetUserUc extends UseCaseFromDef<
  typeof GetUserUcDef,
  UserDeps,
  Loaded,
  Identified
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(GetUserUcDef, deps, module);
  }

  protected async load({ uuid }: Input) {
    const user = await this.resolve.users.findById(uuid);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ uuid });
  }

  protected async execute(_: Input, { user }: Loaded) {
    return ok(user.view());
  }
}
