import {
  GetTelegramAddressesUcDef,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof GetTelegramAddressesUcDef>;

/**
 * Адреса за один запрос к порту (`findByIds`): в ответ попадают только
 * пользователи с профилем, порядок — как во входе, отсутствующие просто
 * не попадают в ответ (без ошибки).
 */
export class GetTelegramAddressesUc extends UseCaseFromDef<
  typeof GetTelegramAddressesUcDef,
  UserDeps,
  undefined,
  Identified
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(GetTelegramAddressesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ userIds }: Input) {
    const users = await this.resolve.users.findByIds(userIds);
    const byUuid = new Map(users.map((user) => [user.uuid, user]));
    const addresses = userIds.flatMap((userId) => {
      const telegramId = byUuid.get(userId)?.view().telegramId;
      return telegramId === undefined ? [] : [{ userId, telegramId }];
    });
    return ok({ addresses });
  }
}
