import {
  ListUsersUcDef,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof ListUsersUcDef>;

/**
 * Список по фильтру входа: отбор, сортировку и лимит выполняет порт
 * (`UserRepo.findAll`), UC только пробрасывает вход и отдаёт `view()`.
 */
export class ListUsersUc extends UseCaseFromDef<
  typeof ListUsersUcDef,
  UserDeps,
  undefined,
  Identified
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(ListUsersUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(input: Input) {
    const users = await this.resolve.users.findAll(input);
    return ok(users.map((user) => user.view()));
  }
}
