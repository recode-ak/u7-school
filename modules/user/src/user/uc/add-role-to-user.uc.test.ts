import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { AddRoleToUserUc } from './add-role-to-user.uc';
import {
  asAdmin,
  asMember,
  MEMBER_ID,
  MISSING_ID,
  makeEnv,
  REQ,
  T1,
  userState,
} from './user-uc.fixture';

// Перенос `api/user/add-role-to-user-uc.test.ts` (3). Порядок «не найден» →
// «нет прав» сохранён (UC `load` раньше Policy).

let env: ReturnType<typeof makeEnv>;
const uc = () => new AddRoleToUserUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
  env.seed(userState());
});

describe('AddRoleToUserUc', () => {
  it('админ добавляет роль: UserView с ролью, запись сохранена, версия и время обновлены', async () => {
    const res = await uc().handle(
      { userId: MEMBER_ID, role: 'MENTOR' },
      asAdmin,
      REQ,
    );

    expect(expectOk(res).roles).toEqual(['GUEST', 'MENTOR']);
    expect(env.stored(MEMBER_ID)).toMatchObject({
      roles: ['GUEST', 'MENTOR'],
      updatedAt: T1,
      version: 1,
    });
  });

  it('роль уже есть — ответ тот же, версия не растёт', async () => {
    const res = await uc().handle(
      { userId: MEMBER_ID, role: 'GUEST' },
      asAdmin,
      REQ,
    );

    expect(expectOk(res).roles).toEqual(['GUEST']);
    expect(env.stored(MEMBER_ID).version).toBe(0);
  });

  it('пользователя нет — USER_NOT_FOUND с uuid', async () => {
    const error = expectErr(
      await uc().handle({ userId: MISSING_ID, role: 'MENTOR' }, asAdmin, REQ),
      'USER_NOT_FOUND',
    );

    expect(error.payload).toEqual({ uuid: MISSING_ID });
  });

  it('пользователя нет и вызывает не-админ — USER_NOT_FOUND раньше Policy', async () => {
    expectErr(
      await uc().handle({ userId: MISSING_ID, role: 'MENTOR' }, asMember, REQ),
      'USER_NOT_FOUND',
    );
  });

  it('не-админ — ACCESS_DENIED (canManageRoles), роли не изменены', async () => {
    const error = expectErr(
      await uc().handle({ userId: MEMBER_ID, role: 'ADMIN' }, asMember, REQ),
      'ACCESS_DENIED',
    );

    expect(error.payload).toMatchObject({ rule: 'canManageRoles' });
    expect(env.stored(MEMBER_ID).roles).toEqual(['GUEST']);
    expect(env.users.saved).toEqual([]);
  });

  it('неизвестная роль — INPUT_VALIDATION', async () => {
    expectErr(
      await uc().handle(
        { userId: MEMBER_ID, role: 'ROOT' as never },
        asAdmin,
        REQ,
      ),
      'INPUT_VALIDATION',
    );
  });
});
