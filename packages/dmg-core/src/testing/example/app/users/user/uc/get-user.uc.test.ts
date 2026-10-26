import { beforeEach, describe, expect, it } from 'bun:test';
import { ModuleFacades } from '#core/app/facade/module-facades';
import {
  type Caller,
  type OperationRef,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import { Trace } from '#core/kernel/trace/trace';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import { UsersModuleDef } from '#core/testing/example/users/index';
import { expectErr, expectOk, testAppContext } from '#core/testing/index';
import { UserMemoryRepo } from '../../infra/user.memory-repo';
import { GetUserUc } from './get-user.uc';

// Query для других модулей: только `system`, ответ — «активна ли учётная
// запись», а не state.

const ACTIVE = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const REMOVED = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = Date.UTC(2026, 9, 1);
const REQ = Trace.fromRequest({ requestId: 'r-1' });

const from: OperationRef = {
  kind: 'useCase',
  module: 'todo',
  name: 'assignTask',
};
const person = new UserCaller<ExampleUser>({
  uuid: ACTIVE,
  hasRole: () => false,
});
const system = new SystemCaller(from, person);

const row = (uuid: string, status: 'active' | 'removed') => ({
  uuid,
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

let users: UserMemoryRepo;
let ctx: ReturnType<typeof testAppContext>;
let uc: GetUserUc;

beforeEach(() => {
  users = new UserMemoryRepo([row(ACTIVE, 'active'), row(REMOVED, 'removed')]);
  ctx = testAppContext({ at: T0 });
  uc = new GetUserUc(
    { app: ctx.app, facades: new ModuleFacades(), users },
    UsersModuleDef,
  );
});

const get = (userId: string, caller: Caller<ExampleUser> = system) =>
  uc.handle({ userId }, caller, REQ);

describe('GetUserUc', () => {
  it('активная учётная запись — active: true', async () => {
    expect(expectOk(await get(ACTIVE))).toEqual({
      userId: ACTIVE,
      active: true,
    });
  });

  it('удалённая учётная запись — active: false', async () => {
    expect(expectOk(await get(REMOVED))).toEqual({
      userId: REMOVED,
      active: false,
    });
  });

  it('нет пользователя — USER_NOT_FOUND', async () => {
    const missing = crypto.randomUUID();
    expect(expectErr(await get(missing), 'USER_NOT_FOUND').payload).toEqual({
      userId: missing,
    });
  });

  it('системный вызов без человека — тоже отвечает (allowAll)', async () => {
    expectOk(await get(ACTIVE, new SystemCaller(from)));
  });

  it('пользователь напрямую — UNAUTHORIZED: только system', async () => {
    expectErr(await get(ACTIVE, person), 'UNAUTHORIZED');
  });

  it('query ничего не пишет и не публикует', async () => {
    const before = (await users.findById(ACTIVE))?.snapshot();
    expectOk(await get(ACTIVE));
    expect((await users.findById(ACTIVE))?.snapshot()).toEqual(before);
    expect(ctx.published).toEqual([]);
  });
});
