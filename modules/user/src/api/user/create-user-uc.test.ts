import { describe, expect, mock, test } from 'bun:test';
import type {
  LegacyUserRepo,
  User,
  UserApiModuleResolver,
} from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { CreateUserUc } from './create-user-uc';

/**
 * Хелпер: создаёт мок-репозиторий и usecase.
 * Моки лежат в переменных, через них настраивается поведение в каждом тесте.
 */
function setupUc() {
  const save = mock(async (_user: User): Promise<void> => {});
  const getByUuid = mock(
    async (_uuid: string): Promise<User | undefined> => undefined,
  );
  const getByUuids = mock(async (_uuids: string[]): Promise<User[]> => []);
  const getByTelegramId = mock(
    async (_id: number): Promise<User | undefined> => undefined,
  );
  const getAll = mock(async (): Promise<User[]> => []);
  const isTelegramIdTaken = mock(
    async (_id: number): Promise<boolean> => false,
  );
  const isEmpty = mock(async (): Promise<boolean> => true);

  const repo: LegacyUserRepo = {
    save,
    getByUuid,
    getByUuids,
    getByTelegramId,
    getAll,
    isTelegramIdTaken,
    isEmpty,
  };
  const uc = new CreateUserUc();
  uc.init({ userRepo: repo } as unknown as UserApiModuleResolver);

  return {
    save,
    getByUuid,
    getByTelegramId,
    getAll,
    isTelegramIdTaken,
    isEmpty,
    repo,
    uc,
  };
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

describe('CreateUserUc', () => {
  describe('SUCCESS', () => {
    test('ADMIN может создавать других пользователей', async () => {
      const { getByUuid, save, uc } = setupUc();
      const admin = makeUser();

      const user = await uc.handle(
        { name: 'Новый студент', telegramId: 2, roles: [Role.STUDENT] },
        admin,
      );

      expect(user.roles).toEqual([Role.STUDENT]);
      expect(user.name).toBe('Новый студент');
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('FAIL', () => {
    test('отклоняет дубликат telegramId', async () => {
      const { getByUuid, isTelegramIdTaken, uc } = setupUc();
      const admin = makeUser();

      isTelegramIdTaken.mockResolvedValueOnce(true);

      await expect(
        uc.handle({ name: 'Б', telegramId: 1, roles: [Role.STUDENT] }, admin),
      ).rejects.toMatchObject({ error: { name: 'TELEGRAM_ID_TAKEN' } });
    });

    test('отклоняет создание пользователем без прав ADMIN', async () => {
      const { getByUuid, uc } = setupUc();
      const student = makeUser({ roles: [Role.STUDENT], telegramId: 2 });

      await expect(
        uc.handle(
          { name: 'Хакер', telegramId: 3, roles: [Role.ADMIN] },
          student,
        ),
      ).rejects.toMatchObject({ error: { name: 'ACCESS_DENIED' } });
    });
  });
});
