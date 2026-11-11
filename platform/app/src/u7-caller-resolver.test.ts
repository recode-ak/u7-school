import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  GetUserUcDef,
  UserAr,
  UserErrors,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { err, GuestCaller, ok, SystemCaller, UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { U7App } from './u7-app';
import { U7CallerResolver } from './u7-caller-resolver';

// Резолвер `Caller` корня сборки (D-50): идентичность из транспорта →
// человек на входе; пользователя читает UC `user.getUser` от системы (D-51),
// субъект — `UserAr` (D-69).

/** Запись `users.json` в legacy-формате: даты — ISO-строки. */
const KNOWN = {
  uuid: '22222222-2222-4222-8222-222222222222',
  name: 'Известный пользователь',
  telegramId: 1,
  roles: ['MENTOR', 'ADMIN'],
  createdAt: '2026-06-01T00:00',
};
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

const req = (): Trace => Trace.fromRequest({ requestId: crypto.randomUUID() });

describe('U7CallerResolver: приложение целиком', () => {
  let dir: string;
  let app: U7App;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-callers-'));
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
    await rm(dir, { recursive: true, force: true });
  });

  test('найденный пользователь — UserCaller, субъект — UserAr с ролями записи', async () => {
    const caller = await app.callers.resolve(KNOWN.uuid, req());

    expect(caller).toBeInstanceOf(UserCaller);
    const subject = caller.subject();
    expect(subject).toBeInstanceOf(UserAr);
    expect(subject?.uuid).toBe(KNOWN.uuid);
    expect(subject?.view().name).toBe(KNOWN.name);
    expect(subject?.view().roles).toEqual(['MENTOR', 'ADMIN']);
  });

  test('неизвестный uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(UNKNOWN, req());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('без uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(undefined, req());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('невалидный uuid от транспорта — исключение наружу (ERR-01), не гость', async () => {
    await expect(app.callers.resolve('не-uuid', req())).rejects.toThrow();
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
    const trace = req();
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

    const caller = await resolverOver(answer).resolve(KNOWN.uuid, req());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('прочий отказ getUser — исключение с кодом (ERR-01)', async () => {
    const answer = err({ code: 'UNAUTHORIZED' });

    await expect(
      resolverOver(answer).resolve(KNOWN.uuid, req()),
    ).rejects.toThrow('UNAUTHORIZED');
  });

  test('без uuid api не вызывается', async () => {
    const calls: Call[] = [];

    const caller = await resolverOver(ok(undefined), calls).resolve(
      undefined,
      req(),
    );

    expect(caller).toBeInstanceOf(GuestCaller);
    expect(calls).toHaveLength(0);
  });
});
