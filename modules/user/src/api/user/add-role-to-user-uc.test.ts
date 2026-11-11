import { describe, expect, mock, test } from 'bun:test';
import type {
  LegacyUserRepo,
  User,
  UserApiModuleResolver,
} from '@u7-scl/domain/user';
import { Role } from '@u7-scl/domain/user';
import { AddRoleToUserUc } from './add-role-to-user-uc';

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
  const uc = new AddRoleToUserUc();
  uc.init({ userRepo: repo } as unknown as UserApiModuleResolver);

  return { save, getByUuid, uc };
}

describe('AddRoleToUserUc', () => {
  describe('SUCCESS', () => {
    test('ADMIN добавляет роль существующему пользователю', async () => {
      const { getByUuid, save, uc } = setupUc();
      const admin = makeUser();
      const target = makeUser({ roles: [Role.STUDENT], telegramId: 2 });

      getByUuid.mockResolvedValueOnce(target);

      const user = await uc.handle(
        { userId: target.uuid, role: Role.MENTOR },
        admin,
      );

      expect(user.roles).toEqual([Role.STUDENT, Role.MENTOR]);
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('FAIL', () => {
    test('отклоняет при несуществующем пользователе', async () => {
      const { getByUuid, uc } = setupUc();
      const admin = makeUser();

      const userId = crypto.randomUUID();
      getByUuid.mockResolvedValueOnce(undefined);

      await expect(
        uc.handle({ userId, role: Role.MENTOR }, admin),
      ).rejects.toMatchObject({
        error: { name: 'USER_NOT_FOUND', payload: { uuid: userId } },
      });
    });

    test('отклоняет при отсутствии прав ADMIN', async () => {
      const { getByUuid, uc } = setupUc();
      const student = makeUser({ roles: [Role.STUDENT], telegramId: 2 });
      const target = makeUser({ roles: [Role.STUDENT], telegramId: 3 });

      getByUuid.mockResolvedValueOnce(target);

      await expect(
        uc.handle({ userId: target.uuid, role: Role.MENTOR }, student),
      ).rejects.toMatchObject({ error: { name: 'ACCESS_DENIED' } });
    });
  });
});
