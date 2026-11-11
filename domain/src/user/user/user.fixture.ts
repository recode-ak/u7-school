import type { UserState } from './user.state';

/** Общие идентификаторы и состояние пользователя для тестов домена. */
export const USER = '11111111-1111-4111-8111-111111111111';

export const T0 = Date.UTC(2026, 5, 1, 10);
export const T1 = Date.UTC(2026, 5, 2);

export const stored = (overrides: Partial<UserState> = {}): UserState => ({
  uuid: USER,
  name: 'Иван',
  telegramId: 123,
  roles: ['GUEST'],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...overrides,
});
