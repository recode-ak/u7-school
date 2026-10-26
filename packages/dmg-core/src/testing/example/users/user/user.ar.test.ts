import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from '#core/testing/index';
import { UserAr } from './user.ar';
import type { UserState } from './user.state';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2);

const stored = (status: UserState['status']): UserState => ({
  uuid: USER,
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

describe('UserAr.remove', () => {
  it('active → removed и событие removed', () => {
    const ar = UserAr.restore(stored('active'));
    expectOk(ar.remove(T1));
    expect(ar.isActive()).toBe(false);
    expect(ar.pullEvents()).toEqual([
      { name: 'users.user.removed', payload: { userId: USER } },
    ]);
  });

  it('удалённый — USER_ALREADY_REMOVED', () => {
    const ar = UserAr.restore(stored('removed'));
    expectErr(ar.remove(T1), 'USER_ALREADY_REMOVED');
    expect(ar.pullEvents()).toEqual([]);
  });
});

describe('вопросы', () => {
  it('isActive: только активная учётная запись', () => {
    expect(UserAr.restore(stored('active')).isActive()).toBe(true);
    expect(UserAr.restore(stored('removed')).isActive()).toBe(false);
  });
});
