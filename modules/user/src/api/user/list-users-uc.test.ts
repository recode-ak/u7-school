import { describe, expect, mock, test } from 'bun:test';
import type {
  User,
  UserApiModuleResolver,
  UserRepo,
} from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { ListUsersUc } from './list-users-uc';

function setupUc() {
  const save = mock(async (): Promise<void> => {});
  const getByUuid = mock(async (): Promise<User | undefined> => undefined);
  const getByUuids = mock(async (_uuids: string[]): Promise<User[]> => []);
  const getByTelegramId = mock(
    async (): Promise<User | undefined> => undefined,
  );
  const getAll = mock(async (): Promise<User[]> => []);
  const isTelegramIdTaken = mock(async (): Promise<boolean> => false);
  const isEmpty = mock(async (): Promise<boolean> => true);

  const repo: UserRepo = {
    save,
    getByUuid,
    getByUuids,
    getByTelegramId,
    getAll,
    isTelegramIdTaken,
    isEmpty,
  };
  const uc = new ListUsersUc();
  uc.init({ userRepo: repo } as unknown as UserApiModuleResolver);

  return { getAll, uc };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uuid: crypto.randomUUID(),
    name: 'Тест',
    telegramId: 1,
    roles: [Role.ADMIN],
    createdAt: '2026-05-01T12:00',
    ...overrides,
  };
}

describe('ListUsersUc', () => {
  test('возвращает всех пользователей', async () => {
    const { getAll, uc } = setupUc();
    const u1 = makeUser({ name: 'Иван' });
    const u2 = makeUser({
      name: 'Мария',
      telegramId: 2,
      roles: [Role.STUDENT],
    });
    getAll.mockResolvedValueOnce([u1, u2]);

    const result = await uc.handle({});

    expect(result.users).toHaveLength(2);
    expect(result.users.map((u) => u.name)).toContain('Иван');
    expect(result.users.map((u) => u.name)).toContain('Мария');
    expect(getAll).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      title: 'по умолчанию (limit 20, sort createdAt:desc)',
      cmd: {},
      args: {
        limit: 20,
        role: undefined,
        name: undefined,
        telegramId: undefined,
        sort: 'createdAt:desc',
      },
    },
    {
      title: 'лимит явно',
      cmd: { limit: 5 },
      args: {
        limit: 5,
        role: undefined,
        name: undefined,
        telegramId: undefined,
        sort: 'createdAt:desc',
      },
    },
    {
      title: 'фильтр по роли',
      cmd: { role: Role.STUDENT },
      args: {
        limit: 20,
        role: Role.STUDENT,
        name: undefined,
        telegramId: undefined,
        sort: 'createdAt:desc',
      },
    },
    {
      title: 'фильтр по имени',
      cmd: { name: 'Иван' },
      args: {
        limit: 20,
        role: undefined,
        name: 'Иван',
        telegramId: undefined,
        sort: 'createdAt:desc',
      },
    },
    {
      title: 'фильтр по telegramId',
      cmd: { telegramId: 12345 },
      args: {
        limit: 20,
        role: undefined,
        name: undefined,
        telegramId: 12345,
        sort: 'createdAt:desc',
      },
    },
    {
      title: 'сортировка явно',
      cmd: { sort: 'name:asc' },
      args: {
        limit: 20,
        role: undefined,
        name: undefined,
        telegramId: undefined,
        sort: 'name:asc',
      },
    },
  ])(
    'передаёт аргументы выборки в репозиторий: $title',
    async ({ cmd, args }) => {
      const { getAll, uc } = setupUc();
      getAll.mockResolvedValueOnce([]);

      await uc.handle(cmd);

      expect(getAll).toHaveBeenCalledWith(args);
    },
  );
});
