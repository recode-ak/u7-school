import { describe, expect, it } from 'bun:test';
import { allowed, denied, GuestCaller, UserCaller } from '#core/index';
import { TaskAr } from './task.ar';
import { type TaskCtx, TaskPolicy } from './task.policy';

type Role = 'admin' | 'student';
type User = { uuid: string; hasRole(role: Role): boolean };

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const user = (uuid: string, ...roles: Role[]) =>
  new UserCaller<User>({ uuid, hasRole: (role) => roles.includes(role) });

const ctx: TaskCtx = {
  task: TaskAr.restore({
    uuid: '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10',
    ownerId: OWNER,
    title: 'Купить хлеб',
    status: 'open',
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  }),
};

const canManage = TaskPolicy.rules.canManage;

describe('TaskPolicy.canManage', () => {
  it('владелец — allowed', () => {
    expect(canManage.evaluate(user(OWNER), ctx)).toEqual(allowed);
  });

  it('администратор — allowed для чужой задачи', () => {
    expect(canManage.evaluate(user(OTHER, 'admin'), ctx)).toEqual(allowed);
  });

  it('чужой без роли — denied', () => {
    expect(canManage.evaluate(user(OTHER, 'student'), ctx)).toEqual(
      denied(
        'canManage',
        'Управлять задачей может владелец или администратор.',
      ),
    );
  });

  it('гость — denied', () => {
    expect(canManage.evaluate(new GuestCaller(), ctx).allowed).toBe(false);
  });
});
