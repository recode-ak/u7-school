import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetUserUc } from './get-user.uc';
import {
  asMember,
  MEMBER_ID,
  MISSING_ID,
  makeEnv,
  REQ,
  userState,
} from './user-uc.fixture';

// Перенос `api/user/get-user-uc.test.ts` (2 теста).

let env: ReturnType<typeof makeEnv>;
const uc = () => new GetUserUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
});

describe('GetUserUc', () => {
  it('пользователь найден — его UserView', async () => {
    env.seed(userState({ roles: ['MENTOR'] }));

    const res = await uc().handle({ uuid: MEMBER_ID }, asMember, REQ);

    expect(expectOk(res)).toEqual(userState({ roles: ['MENTOR'] }));
  });

  it('пользователя нет — USER_NOT_FOUND с uuid в payload', async () => {
    const error = expectErr(
      await uc().handle({ uuid: MISSING_ID }, asMember, REQ),
      'USER_NOT_FOUND',
    );

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ uuid: MISSING_ID });
  });
});
