import { describe, expect, it } from 'bun:test';
import { Role } from './contract';

// Роль — часть контракта `user`; субъект Policy потока читает её
// оттуда, а не из legacy `@u7-scl/domain/user`.
describe('contract user: Role', () => {
  it('значения ролей — как в legacy', () => {
    const roles: Record<string, string> = { ...Role };
    expect(roles).toEqual({
      GUEST: 'GUEST',
      SUBSCRIBER: 'SUBSCRIBER',
      MENTOR: 'MENTOR',
      AUTHOR: 'AUTHOR',
      ADMIN: 'ADMIN',
    });
  });
});
