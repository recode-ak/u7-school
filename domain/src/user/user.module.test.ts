import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { UserModuleDef } from './contract';

describe('UserModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, без зависимостей, агрегат user и Def UC', () => {
    expect(UserModuleDef.external).toBe(true);
    expect(normalize(UserModuleDef)).toMatchObject({
      dependsOn: [],
      aggregates: ['user'],
      useCases: ['getTelegramAddresses'],
      reactions: [],
      jobs: [],
    });
  });
});
