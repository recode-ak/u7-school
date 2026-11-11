import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { UserModuleDef } from './contract';

describe('UserModuleDef — модуль на Def', () => {
  it('паспорт: без зависимостей, агрегат user и Def UC', () => {
    expect(UserModuleDef.external).toBeFalsy();
    expect(normalize(UserModuleDef)).toMatchObject({
      dependsOn: [],
      aggregates: ['user'],
      useCases: [
        'addRoleToUser',
        'getTelegramAddresses',
        'getUser',
        'getUserByTelegramId',
        'getUsersByIds',
        'listUsers',
        'registerGuest',
        'removeRoleFromUser',
      ],
      reactions: [],
      jobs: [],
    });
  });
});
