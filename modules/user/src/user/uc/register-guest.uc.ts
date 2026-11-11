import {
  RegisterGuestUcDef,
  UserAr,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { ok, type ReadonlyAr } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof RegisterGuestUcDef>;

/** Контекст правила `telegramIdFree`: держатель telegramId, если он есть. */
type Loaded = { readonly holder?: ReadonlyAr<UserAr> };

export class RegisterGuestUc extends UseCaseFromDef<
  typeof RegisterGuestUcDef,
  UserDeps,
  Loaded,
  ReadonlyAr<UserAr>
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(RegisterGuestUcDef, deps, module);
  }

  /** Держатель telegramId — контекст правила; занят — отказ правила. */
  protected async load({ telegramId }: Input) {
    const holder = await this.resolve.users.findByTelegramId(telegramId);
    return ok({ holder });
  }

  protected async execute(
    { telegramId, name, nick }: Input,
    _loaded: Loaded,
    uow: UnitOfWork,
  ) {
    const created = UserAr.create(
      { uuid: crypto.randomUUID(), name, telegramId, nick },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.users);
    return ok(created.value.view());
  }
}
