import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  GetUserByTelegramIdUcDef,
  GetUserUcDef,
  UserAr,
  UserErrors,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { err, GuestCaller, ok, SystemCaller, UserCaller } from 'dmg-core';
import { TempDir, testTrace } from 'dmg-core/testing';
import { U7App } from './u7-app';
import { U7CallerResolver } from './u7-caller-resolver';

// Резолвер `Caller` корня сборки (D-50): идентичность из транспорта →
// человек на входе; пользователя читает UC `user.getUser` от системы (D-51),
// субъект — `UserAr` (D-69).

/** Запись `users.json`: даты — числа (мс UTC). */
const KNOWN = {
  uuid: '22222222-2222-4222-8222-222222222222',
  name: 'Известный пользователь',
  telegramId: 1,
  roles: ['MENTOR', 'ADMIN'],
  createdAt: Date.UTC(2026, 5, 1),
};
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

describe('U7CallerResolver: приложение целиком', () => {
  let tmp: TempDir;
  let dir: string;
  let app: U7App;

  beforeAll(async () => {
    tmp = TempDir.create('u7-app-callers-');
    dir = tmp.path;
    await mkdir(join(dir, 'users'), { recursive: true });
    await Bun.write(join(dir, 'users', 'users.json'), JSON.stringify([KNOWN]));
    app = new U7App(
      {
        mode: 'test',
        dbDir: dir,
        communityGroup: { id: 1, url: 'https://t.me/test-comm' },
        studentGroup: { id: 2, inviteUrl: 'https://t.me/test-stud' },
      },
      { logger: new ConsoleLogger() },
    );
  });

  afterAll(async () => {
    tmp.dispose();
  });

  test('найденный пользователь — UserCaller, субъект — UserAr с ролями записи', async () => {
    const caller = await app.callers.resolve(KNOWN.uuid, testTrace());

    expect(caller).toBeInstanceOf(UserCaller);
    const subject = caller.subject();
    expect(subject).toBeInstanceOf(UserAr);
    expect(subject?.uuid).toBe(KNOWN.uuid);
    expect(subject?.view().name).toBe(KNOWN.name);
    expect(subject?.view().roles).toEqual(['MENTOR', 'ADMIN']);
  });

  test('неизвестный uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(UNKNOWN, testTrace());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('без uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(undefined, testTrace());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('невалидный uuid от транспорта — исключение наружу (ERR-01), не гость', async () => {
    await expect(app.callers.resolve('не-uuid', testTrace())).rejects.toThrow();
  });
});

describe('U7CallerResolver: вызов getUser (подмена api)', () => {
  type Call = Parameters<
    ConstructorParameters<typeof U7CallerResolver>[0]['dispatch']
  >;

  const resolverOver = (answer: unknown, calls: Call[] = []) =>
    new U7CallerResolver({
      dispatch: async (...args: Call) => {
        calls.push(args);
        return answer;
      },
    } as never);

  test('getUser — от SystemCaller (D-51) с тем же следом', async () => {
    const calls: Call[] = [];
    const trace = testTrace();
    const view = UserAr.restore({
      uuid: KNOWN.uuid,
      name: KNOWN.name,
      telegramId: 1,
      roles: ['GUEST'],
      createdAt: 1,
      updatedAt: 1,
      version: 0,
    }).view();

    await resolverOver(ok(view), calls).resolve(KNOWN.uuid, trace);

    const [call] = calls;
    if (call === undefined) throw new Error('getUser не вызван');
    const [module, command, caller, passed] = call;
    expect(module).toBe(UserModuleDef);
    expect(command).toEqual(GetUserUcDef.command({ uuid: KNOWN.uuid }));
    expect(caller).toBeInstanceOf(SystemCaller);
    expect((caller as SystemCaller).from).toEqual({
      kind: 'app',
      module: 'u7-app',
      name: 'resolveCaller',
    });
    expect(passed).toBe(trace);
  });

  test('USER_NOT_FOUND — GuestCaller', async () => {
    const answer = err({ code: UserErrors.NOT_FOUND.code });

    const caller = await resolverOver(answer).resolve(KNOWN.uuid, testTrace());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('прочий отказ getUser — исключение с кодом (ERR-01)', async () => {
    const answer = err({ code: 'UNAUTHORIZED' });

    await expect(
      resolverOver(answer).resolve(KNOWN.uuid, testTrace()),
    ).rejects.toThrow('UNAUTHORIZED');
  });

  test('без uuid api не вызывается', async () => {
    const calls: Call[] = [];

    const caller = await resolverOver(ok(undefined), calls).resolve(
      undefined,
      testTrace(),
    );

    expect(caller).toBeInstanceOf(GuestCaller);
    expect(calls).toHaveLength(0);
  });
});

describe('U7CallerResolver.resolveByTelegramId', () => {
  type Call = Parameters<
    ConstructorParameters<typeof U7CallerResolver>[0]['dispatch']
  >;

  const resolverOver = (answer: unknown, calls: Call[] = []) =>
    new U7CallerResolver({
      dispatch: async (...args: Call) => {
        calls.push(args);
        return answer;
      },
    } as never);

  const view = UserAr.restore({
    uuid: KNOWN.uuid,
    name: KNOWN.name,
    telegramId: 1,
    roles: ['MENTOR'],
    createdAt: 1,
    updatedAt: 1,
    version: 0,
  }).view();

  test('getUserByTelegramId — от SystemCaller с тем же следом; найден — UserCaller над UserAr', async () => {
    const calls: Call[] = [];
    const trace = testTrace();

    const caller = await resolverOver(ok(view), calls).resolveByTelegramId(
      1,
      trace,
    );

    const [call] = calls;
    if (call === undefined) throw new Error('getUserByTelegramId не вызван');
    const [module, command, from, passed] = call;
    expect(module).toBe(UserModuleDef);
    expect(command).toEqual(
      GetUserByTelegramIdUcDef.command({ telegramId: 1 }),
    );
    expect(from).toBeInstanceOf(SystemCaller);
    expect(passed).toBe(trace);
    expect(caller).toBeInstanceOf(UserCaller);
    expect(caller.subject()?.uuid).toBe(KNOWN.uuid);
  });

  test('USER_NOT_FOUND — GuestCaller', async () => {
    const answer = err({ code: UserErrors.NOT_FOUND.code });

    const caller = await resolverOver(answer).resolveByTelegramId(
      1,
      testTrace(),
    );

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('прочий отказ — исключение с кодом (ERR-01)', async () => {
    const answer = err({ code: 'UNAUTHORIZED' });

    await expect(
      resolverOver(answer).resolveByTelegramId(1, testTrace()),
    ).rejects.toThrow('UNAUTHORIZED');
  });
});
