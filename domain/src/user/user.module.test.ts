import { describe, expect, it } from 'bun:test';
import { ArchChecker } from 'dmg-core/arch';
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

  it('ArchChecker — без нарушений', () => {
    expect(
      new ArchChecker(DefIndex.from([UserModuleDef]))
        .check()
        .map((v) => v.format()),
    ).toEqual([]);
  });
});
