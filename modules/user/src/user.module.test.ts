import { beforeEach, describe, expect, it } from 'bun:test';
import { UserAr } from '@u7-scl/domain/user';
import {
  AddRoleToUserUcDef,
  GetTelegramAddressesUcDef,
  GetUserUcDef,
  ListUsersUcDef,
  RegisterGuestUcDef,
  type UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { SystemCaller, UserCaller } from 'dmg-core';
import { type AppContext, ModuleFacade, ModuleFacades } from 'dmg-core/app';
import {
  expectOk,
  TEST_TRACE,
  testAppContext,
  testTrace,
  useTempDir,
} from 'dmg-core/testing';
import { UserJsonRepo } from './infra/user.json-repo';
import { adminState, userState } from './user/uc/user-uc.fixture';
import { UserRepoFake } from './user/user.repo.fake';
import { createUserModule } from './user.module';

// Настоящий UC над `findByIds`: адреса собираются одним запросом по порту.

const A = '22222222-2222-4222-8222-222222222222';
const B = '77777777-7777-4777-8777-777777777777';
const asSystem = () =>
  new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

/** Профили: uuid → telegramId; остальных в репозитории нет. */
function users(profiles: Record<string, number>) {
  const repo = new UserRepoFake();
  const asked: string[][] = [];
  repo.findByIds = async (ids: string[]) => {
    asked.push(ids);
    return Object.entries(profiles)
      .filter(([uuid]) => ids.includes(uuid))
      .map(([uuid, telegramId]) =>
        UserAr.restore(userState({ uuid, telegramId })),
      );
  };
  const facade = new ModuleFacade(
    createUserModule({ app, facades: new ModuleFacades(), users: repo }),
  );
  return { facade, asked };
}

const ask = (facade: ModuleFacade<typeof UserModuleDef>, userIds: string[]) =>
  facade.handle(GetTelegramAddressesUcDef, { userIds }, asSystem(), TEST_TRACE);

describe('getTelegramAddresses: UC над findByIds', () => {
  it('адреса как есть, в порядке входа, одним запросом', async () => {
    const { facade, asked } = users({ [A]: 111, [B]: 222 });

    expect(expectOk(await ask(facade, [B, A]))).toEqual({
      addresses: [
        { userId: B, telegramId: 222 },
        { userId: A, telegramId: 111 },
      ],
    });
    expect(asked).toEqual([[B, A]]);
  });

  it('нет профиля — пользователя нет в ответе, без ошибки', async () => {
    const { facade } = users({ [A]: 111 });

    expect(expectOk(await ask(facade, [A, B]))).toEqual({
      addresses: [{ userId: A, telegramId: 111 }],
    });
  });
});

describe('createUserModule', () => {
  const dir = useTempDir('user-module-');

  it('smoke: registerGuest → getUser → addRoleToUser → listUsers на настоящем репозитории', async () => {
    const repo = new UserJsonRepo(dir().file('users.json'));
    const module = createUserModule({
      app,
      facades: new ModuleFacades(),
      users: repo,
    });
    const admin = new UserCaller(UserAr.restore(adminState));

    const registered = expectOk(
      await module.dispatch(
        RegisterGuestUcDef.command({ telegramId: 501, name: 'Новичок' }),
        admin,
        testTrace(),
      ),
    );
    expect(registered.roles).toEqual(['GUEST']);

    const found = expectOk(
      await module.dispatch(
        GetUserUcDef.command({ uuid: registered.uuid }),
        admin,
        testTrace(),
      ),
    );
    expect(found).toEqual(registered);

    const promoted = expectOk(
      await module.dispatch(
        AddRoleToUserUcDef.command({ userId: registered.uuid, role: 'MENTOR' }),
        admin,
        testTrace(),
      ),
    );
    expect(promoted.roles).toEqual(['GUEST', 'MENTOR']);

    const listed = expectOk(
      await module.dispatch(
        ListUsersUcDef.command({ role: 'MENTOR' }),
        admin,
        testTrace(),
      ),
    );
    expect(listed.map((u) => u.uuid)).toEqual([registered.uuid]);
    expect((await repo.findById(registered.uuid))?.snapshot().roles).toEqual([
      'GUEST',
      'MENTOR',
    ]);
  });
});
