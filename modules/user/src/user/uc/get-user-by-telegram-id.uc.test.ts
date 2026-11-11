import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetUserByTelegramIdUc } from './get-user-by-telegram-id.uc';
import { asMember, makeEnv, REQ, userState } from './user-uc.fixture';

// Перенос `api/user/get-user-by-telegram-id-uc.test.ts` (2 теста).

let env: ReturnType<typeof makeEnv>;
const uc = () => new GetUserByTelegramIdUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
});

describe('GetUserByTelegramIdUc', () => {
  it('пользователь найден по telegramId — его UserView', async () => {
    env.seed(userState({ telegramId: 555 }));

    const res = await uc().handle({ telegramId: 555 }, asMember, REQ);

    expect(expectOk(res)).toEqual(userState({ telegramId: 555 }));
  });

  it('пользователя нет — USER_NOT_FOUND с telegramId в payload', async () => {
    env.seed(userState({ telegramId: 555 }));

    const error = expectErr(
      await uc().handle({ telegramId: 556 }, asMember, REQ),
      'USER_NOT_FOUND',
    );

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ telegramId: 556 });
  });
});
