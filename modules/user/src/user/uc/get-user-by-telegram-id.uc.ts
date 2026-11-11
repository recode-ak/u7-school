import {
  GetUserByTelegramIdUcDef,
  type UserAr,
  UserErrors,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof GetUserByTelegramIdUcDef>;

/** Загруженное — контекст ответа и источник `USER_NOT_FOUND`. */
type Loaded = { readonly user: UserAr };

export class GetUserByTelegramIdUc extends UseCaseFromDef<
  typeof GetUserByTelegramIdUcDef,
  UserDeps,
  Loaded,
  Identified
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(GetUserByTelegramIdUcDef, deps, module);
  }

  protected async load({ telegramId }: Input) {
    const user = await this.resolve.users.findByTelegramId(telegramId);
    return user ? ok({ user }) : UserErrors.NOT_FOUND.err({ telegramId });
  }

  protected async execute(_: Input, { user }: Loaded) {
    return ok(user.view());
  }
}
