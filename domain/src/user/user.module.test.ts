import { describe, expect, it } from 'bun:test';
import { checkDefs } from 'dmg-core/arch';
import { DefIndex, normalize } from 'dmg-core/graph';
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
    expect(
      checkDefs(DefIndex.from([UserModuleDef])).map((v) => v.format()),
    ).toEqual([]);
  });
});
