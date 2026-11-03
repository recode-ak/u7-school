// Адаптер UC внешнего контракта над legacy-фасадом пользователей.
import {
  GetTelegramAddressesUcDef,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserModuleDeps } from '../../user.module';

type Input = ParsedInputOf<typeof GetTelegramAddressesUcDef>;

/**
 * `getTelegramAddresses` поверх legacy
 * `getUserByUuid` (батча в legacy нет — по одному): пользователь без
 * профиля или без `telegramId` в ответ не попадает.
 */
export class GetTelegramAddressesUc extends UseCaseFromDef<
  typeof GetTelegramAddressesUcDef,
  UserModuleDeps,
  undefined
> {
  constructor(deps: UserModuleDeps, module: typeof UserModuleDef) {
    super(GetTelegramAddressesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ userIds }: Input) {
    const addresses: { userId: string; telegramId: number }[] = [];
    for (const userId of userIds) {
      const user = await this.resolve.legacy.getUserByUuid(userId);
      if (user?.telegramId !== undefined) {
        addresses.push({ userId, telegramId: user.telegramId });
      }
    }
    return ok({ addresses });
  }
}
