import { beforeEach, describe, expect, it } from 'bun:test';
import {
  GetTelegramAddressesUcDef,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { SystemCaller } from 'dmg-core';
import {
  type AppContext,
  ModuleFacade,
  ModuleFacades,
  Trace,
} from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { createUserModule, type UserLegacy } from './user.module';

// Адаптер над legacy-фасадом: адреса собираются по профилям legacy-фасада пользователей.

const A = '22222222-2222-4222-8222-222222222222';
const B = '77777777-7777-4777-8777-777777777777';
const C = '88888888-8888-4888-8888-888888888888';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = () =>
  new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

/** Профили legacy: uuid → telegramId (null — профиль без адреса); остальных нет. */
function users(profiles: Record<string, number | null>) {
  const asked: string[] = [];
  const legacy = {
    getUserByUuid: async (uuid: string) => {
      asked.push(uuid);
      if (!(uuid in profiles)) return undefined;
      const telegramId = profiles[uuid];
      return {
        uuid,
        ...(telegramId !== null && { telegramId }),
      } as never;
    },
  } satisfies UserLegacy;
  const facade = new ModuleFacade(
    createUserModule({ app, facades: new ModuleFacades(), legacy }),
  );
  return { facade, asked };
}

const ask = (facade: ModuleFacade<typeof UserModuleDef>, userIds: string[]) =>
  facade.handle(GetTelegramAddressesUcDef, { userIds }, asSystem(), REQ);

describe('getTelegramAddresses: адаптер над getUserByUuid', () => {
  it('у пользователей есть telegramId — адреса как есть, по порядку', async () => {
    const { facade, asked } = users({ [A]: 111, [B]: 222 });
    expect(expectOk(await ask(facade, [A, B]))).toEqual({
      addresses: [
        { userId: A, telegramId: 111 },
        { userId: B, telegramId: 222 },
      ],
    });
    expect(asked).toEqual([A, B]);
  });

  it('нет профиля — пользователя нет в ответе', async () => {
    const { facade } = users({ [A]: 111 });
    expect(expectOk(await ask(facade, [A, B]))).toEqual({
      addresses: [{ userId: A, telegramId: 111 }],
    });
  });

  it('профиль без telegramId — пользователя нет в ответе', async () => {
    const { facade } = users({ [A]: null, [C]: 333 });
    expect(expectOk(await ask(facade, [A, C]))).toEqual({
      addresses: [{ userId: C, telegramId: 333 }],
    });
  });
});
