import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
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

  it('checkDefs — без нарушений', () => {
    expect(checkDefs(indexDefs([UserModuleDef])).map(formatViolation)).toEqual(
      [],
    );
  });
});
