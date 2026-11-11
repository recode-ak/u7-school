import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app-legacy';
import { ConsoleLogger } from '@u7-scl/core/shared';
import { GuestCaller, UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { U7App } from './u7-app';

// Резолвер `Caller` корня сборки (D-50): идентичность из транспорта →
// человек на входе через legacy-фасад пользователей (адаптер над legacy-фасадом).

const KNOWN: User = {
  uuid: '22222222-2222-4222-8222-222222222222',
  name: 'Известный пользователь',
  telegramId: 1,
  roles: [Role.GUEST],
  createdAt: '2026-06-01T00:00',
};
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

const req = (): Trace => Trace.fromRequest({ requestId: crypto.randomUUID() });

describe('U7CallerResolver', () => {
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

  test('найденный пользователь — UserCaller над ним', async () => {
    const caller = await app.callers.resolve(KNOWN.uuid, req());

    expect(caller).toBeInstanceOf(UserCaller);
    if (!(caller instanceof UserCaller)) return;
    expect(caller.user.uuid).toBe(KNOWN.uuid);
    expect(caller.user.name).toBe(KNOWN.name);
  });

  test('неизвестный uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(UNKNOWN, req());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('без uuid — GuestCaller', async () => {
    const caller = await app.callers.resolve(undefined, req());

    expect(caller).toBeInstanceOf(GuestCaller);
  });

  test('сбой фасада — исключение наружу (ERR-01)', async () => {
    // Невалидный uuid от транспорта: legacy get-user отвергает вход — не гость.
    await expect(app.callers.resolve('не-uuid', req())).rejects.toThrow();
  });
});
