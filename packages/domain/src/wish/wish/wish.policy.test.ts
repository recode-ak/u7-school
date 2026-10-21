import { describe, expect, it } from 'bun:test';
import { allowed, denied, GuestCaller, UserCaller } from 'dmg-core';
import { WishAr } from './wish.ar';
import { type WishCtx, WishPolicy } from './wish.policy';

type User = { readonly uuid: string };

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const user = (uuid: string) => new UserCaller<User>({ uuid });

const ctx: WishCtx = {
  wish: WishAr.restore({
    uuid: '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10',
    userId: OWNER,
    target: {
      kind: 'course',
      courseId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    },
    status: 'expressed',
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  }),
};

const canCancel = WishPolicy.rules.canCancel;

describe('WishPolicy.canCancel', () => {
  it('владелец желания — allowed', () => {
    expect(canCancel.evaluate(user(OWNER), ctx)).toEqual(allowed);
  });

  it('чужой пользователь — denied', () => {
    expect(canCancel.evaluate(user(OTHER), ctx)).toEqual(
      denied('isAuthor', 'Отменить желание может только его автор.'),
    );
  });

  it('гость — denied', () => {
    expect(canCancel.evaluate(new GuestCaller(), ctx).allowed).toBe(false);
  });
});
