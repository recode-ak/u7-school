import { describe, expect, test } from 'bun:test';
import { TEST_SCHOOL, type U7AppResolver } from '@u7-scl/app-legacy/domain';
import type { User } from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { LegacyUserJsonRepo } from '#infra-legacy/db/user-json-repo';
import { UserApiModule } from './module';

const NO_SEED = '/nonexistent-seed.json';
const JSON_FILE = '/tmp/user-module-test.json';

const UC_NAMES = [
  'add-role-to-user',
  'create-user',
  'get-user',
  'get-user-by-telegram-id',
  'get-users-by-ids',
  'list-users',
  'notify-user',
  'register-guest',
  'remove-role-to-user',
] as const;

const appResolver: U7AppResolver = {
  logger: console as any,
  mode: 'test' as const,
  eventBus: {
    publish() {},
    subscribe() {
      return () => {};
    },
  },
  school: TEST_SCHOOL,
};

describe('UserApiModule + LegacyUserJsonRepo', () => {
  test('сборка: реестр из 9 UC и вертикаль create → get → list → get-by-telegram-id → get-users-by-ids', async () => {
    await Bun.$`rm -f ${JSON_FILE}`;

    const repo = new LegacyUserJsonRepo(JSON_FILE, NO_SEED);
    const mod = new UserApiModule({
      userRepo: repo,
      appResolver,
      eventBus: appResolver.eventBus,
    });

    expect(mod.useCases.map((uc) => uc.getUcName()).sort()).toEqual([
      ...UC_NAMES,
    ]);

    const admin: User = {
      uuid: crypto.randomUUID(),
      name: 'Админ',
      telegramId: 1,
      roles: [Role.ADMIN],
      createdAt: '2026-05-01T12:00',
    };
    await repo.save(admin);

    const created = await mod.execute(
      'create-user',
      { name: 'Иван', telegramId: 2, roles: [Role.STUDENT] },
      admin,
    );
    expect(created.roles).toEqual([Role.STUDENT]);

    const got = await mod.execute('get-user', { uuid: created.uuid });
    expect(got.name).toBe('Иван');

    const list = await mod.execute('list-users', {});
    expect(list.users).toHaveLength(2);

    const byTelegramId = await mod.execute('get-user-by-telegram-id', {
      telegramId: 2,
    });
    expect(byTelegramId.name).toBe('Иван');

    const batch = await mod.execute(
      'get-users-by-ids',
      { userIds: [created.uuid] },
      admin,
    );
    expect(batch.map((u) => u.name)).toEqual(['Иван']);

    await Bun.$`rm -f ${JSON_FILE}`;
  });
});
