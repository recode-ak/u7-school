import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { RemoveRoleFromUserUc } from './remove-role-from-user.uc';
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

// У legacy `remove-role-to-user` теста не было (пробел п. 14 брифа).

let env: ReturnType<typeof makeEnv>;
const uc = () => new RemoveRoleFromUserUc(env.deps, UserModuleDef);

beforeEach(() => {
  env = makeEnv();
  env.seed(userState({ roles: ['GUEST', 'MENTOR'] }));
});

describe('RemoveRoleFromUserUc', () => {
  it('админ снимает роль: UserView без неё, запись сохранена, версия и время обновлены', async () => {
    const res = await uc().handle(
      { userId: MEMBER_ID, role: 'MENTOR' },
      asAdmin,
      REQ,
    );

    expect(expectOk(res).roles).toEqual(['GUEST']);
    expect(env.stored(MEMBER_ID)).toMatchObject({
      roles: ['GUEST'],
      updatedAt: T1,
      version: 1,
    });
  });

  it('снятие последней роли оставляет GUEST', async () => {
    env.seed(userState({ roles: ['MENTOR'] }));

    const res = await uc().handle(
      { userId: MEMBER_ID, role: 'MENTOR' },
      asAdmin,
      REQ,
    );

    expect(expectOk(res).roles).toEqual(['GUEST']);
  });

  it('роли нет — ответ тот же, версия не растёт', async () => {
    const res = await uc().handle(
      { userId: MEMBER_ID, role: 'ADMIN' },
      asAdmin,
      REQ,
    );

    expect(expectOk(res).roles).toEqual(['GUEST', 'MENTOR']);
    expect(env.stored(MEMBER_ID).version).toBe(0);
  });

  it('пользователя нет — USER_NOT_FOUND раньше Policy (вызывает не-админ)', async () => {
    const error = expectErr(
      await uc().handle({ userId: MISSING_ID, role: 'MENTOR' }, asMember, REQ),
      'USER_NOT_FOUND',
    );

    expect(error.payload).toEqual({ uuid: MISSING_ID });
  });

  it('не-админ — ACCESS_DENIED (canManageRoles), роли не изменены', async () => {
    const error = expectErr(
      await uc().handle({ userId: MEMBER_ID, role: 'MENTOR' }, asMember, REQ),
      'ACCESS_DENIED',
    );

    expect(error.payload).toMatchObject({ rule: 'canManageRoles' });
    expect(env.stored(MEMBER_ID).roles).toEqual(['GUEST', 'MENTOR']);
    expect(env.users.saved).toEqual([]);
  });
});
